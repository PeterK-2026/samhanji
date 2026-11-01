// 역사 임무: 지도 정복 대신 한 사건을 짧게 겪고 실제 기록과 비교한다. 난수가 없어 다시 하면 선택만 달라진다.
import {
  ENDING_RECORD, EVIDENCE, INTRO, QUIZ, SOURCES, START, STAT_LABEL, STEPS, type MissionChoice, type StatKey, type Stats,
} from "../data/mission-ansi";
import type { IO } from "./io";

export type Ending = "held" | "costly" | "wall" | "food" | "morale";

const KEYS: StatKey[] = ["wall", "food", "morale", "people"];
const LOST: Record<"wall" | "food" | "morale", string> = {
  wall: "성벽이 무너져 성이 함락되었습니다.",
  food: "군량이 바닥나 더 버틸 수 없었습니다.",
  morale: "사기가 꺾여 성문이 열렸습니다.",
};

export function applyDelta(st: Stats, d: Partial<Stats>): Stats {
  const out = { ...st };
  for (const k of KEYS) out[k] = Math.max(0, Math.min(100, st[k] + (d[k] ?? 0)));
  return out;
}

export function lostBy(st: Stats): "wall" | "food" | "morale" | null {
  return st.wall <= 0 ? "wall" : st.food <= 0 ? "food" : st.morale <= 0 ? "morale" : null;
}

// 선택 번호(0부터)의 열로 임무를 끝까지 계산한다
export function simulate(picks: number[]): { stats: Stats; ending: Ending; steps: number } {
  let st = { ...START };
  for (const [i, step] of STEPS.entries()) {
    st = applyDelta(applyDelta(st, step.choices[picks[i]].delta), step.siege);
    const lost = lostBy(st);
    if (lost) return { stats: st, ending: lost, steps: i + 1 };
  }
  return { stats: st, ending: st.people < 25 ? "costly" : "held", steps: STEPS.length };
}

const preview = (d: Partial<Stats>) =>
  KEYS.filter((k) => d[k]).map((k) => `${STAT_LABEL[k]} ${d[k]! > 0 ? "+" : ""}${d[k]}`).join(" · ");

function card(io: IO, id: string) {
  const c = EVIDENCE[id];
  io.showOfficer(c.id, c.name, c.rows);
}

function show(io: IO, date: string, title: string, body: string, st: Stats) {
  io.missionCard?.({ date, title, body, stats: KEYS.map((k) => ({ label: STAT_LABEL[k], v: st[k] })) });
}

// 임무 한 판. 고른 선택지를 돌려준다
async function play(io: IO): Promise<{ chosen: MissionChoice[]; ending: Ending; stats: Stats }> {
  let st = { ...START };
  const chosen: MissionChoice[] = [];
  io.clear();
  show(io, "645년", "안시성을 지켜라", "당 태종의 대군이 다가온다", st);
  for (const t of INTRO) io.say(t);
  card(io, "manchun");
  await io.pause("임무를 시작하려면 누르십시오");

  for (const step of STEPS) {
    io.clear();
    show(io, step.date, step.title, `결정 ${chosen.length + 1} / ${STEPS.length}`, st);
    for (const t of step.facts) io.say(t);
    if (step.card) card(io, step.card);
    const v = await io.choose(step.question, step.choices.map((c, i) => ({
      value: i + 1, label: `[${c.tag}] ${c.label} (${preview(c.delta)})`,
    })), { columns: 1 });
    const c = step.choices[(v ?? 1) - 1];
    chosen.push(c);
    st = applyDelta(st, c.delta);
    io.say(c.result);
    st = applyDelta(st, step.siege);
    io.say(`당군의 공격과 시간이 흘렀습니다. (${preview(step.siege)})`);
    io.say(`지금 상태: ${KEYS.map((k) => `${STAT_LABEL[k]} ${st[k]}`).join(" · ")}`);
    show(io, step.date, step.title, "결정의 결과", st);
    const lost = lostBy(st);
    if (lost) {
      io.say(LOST[lost]);
      await io.pause();
      return { chosen, ending: lost, stats: st };
    }
    await io.pause();
  }
  return { chosen, ending: st.people < 25 ? "costly" : "held", stats: st };
}

// 내 선택과 실제 기록을 나란히 놓고, 사실과 게임 수치를 구별해 본다. 정답을 맞혀도 점수는 없다
async function review(io: IO, r: { chosen: MissionChoice[]; ending: Ending; stats: Stats }) {
  io.clear();
  const head = r.ending === "held" ? "성을 지켜 냈습니다."
    : r.ending === "costly" ? "성은 지켰지만 주민의 희생이 컸습니다."
      : LOST[r.ending];
  show(io, "회고", "내 선택과 실제 기록", head, r.stats);
  io.say(`내 결과: ${head} (이 임무의 규칙에서 나온 결과입니다)`);
  for (const [i, c] of r.chosen.entries()) {
    io.say(`${STEPS[i].date} 내 선택: ${c.label}`);
    io.say(`→ 실제 기록: ${STEPS[i].record}`);
  }
  for (const t of ENDING_RECORD) io.say(t);
  io.say("같은 선택이 역사에서도 같은 결과를 낳았을 것이라고 말할 수는 없습니다.");
  const v = await io.choose(QUIZ.question, QUIZ.options.map((o, i) => ({ value: i + 1, label: o.label })), { columns: 1 });
  const o = QUIZ.options[(v ?? 1) - 1];
  io.say(`[${o.kind}] ${o.note}`);
  if (o.kind !== "기록") io.say(`사료로 확인되는 것은 "${QUIZ.options.find((x) => x.kind === "기록")!.label}"입니다.`);
  io.say(SOURCES);
}

// 임무 전체. 다시 하기를 고르는 동안 되풀이한다
export async function runMission(io: IO): Promise<void> {
  for (;;) {
    await review(io, await play(io));
    for (;;) {
      const v = await io.choose("이제 무엇을 하겠습니까?", [
        { value: 1, label: "다른 선택으로 다시 하기" }, { value: 2, label: "인물 근거 카드 보기" }, { value: 3, label: "타이틀로" },
      ], { columns: 3 });
      if (v === 1) break;
      if (v === 3 || v === null) {
        io.missionCard?.(null);
        return;
      }
      for (const id of Object.keys(EVIDENCE)) card(io, id);
    }
  }
}
