// 안시성 임무: 선택마다 결과가 달라지고, 역사와 같은 선택이 유일한 정답이 아니며, 근거 태그가 빠지지 않는다
import { describe, expect, it } from "vitest";
import { ENDING_RECORD, EVIDENCE, INTRO, QUIZ, STEPS } from "../src/data/mission-ansi";
import type { IO, Option } from "../src/engine/io";
import { applyDelta, runMission, simulate } from "../src/engine/mission";

const all = STEPS[0].choices.flatMap((_, a) => STEPS[1].choices.flatMap((_, b) => STEPS[2].choices.map((_, c) => [a, b, c])));
const WIN = ["held", "costly"];

describe("임무 균형", () => {
  it("27가지 경로에 성공과 실패가 모두 있고 결말도 여럿이다", () => {
    const ends = all.map((p) => simulate(p).ending);
    expect(all).toHaveLength(27);
    expect(new Set(ends).size).toBeGreaterThanOrEqual(3);
    const wins = ends.filter((e) => WIN.includes(e)).length;
    expect(wins).toBeGreaterThanOrEqual(6);
    expect(wins).toBeLessThanOrEqual(21);
  });

  it("첫 결정의 어느 선택으로도 끝까지 지킬 길이 있다", () => {
    for (const a of [0, 1, 2]) expect(all.some((p) => p[0] === a && WIN.includes(simulate(p).ending))).toBe(true);
  });

  it("기록에 없는 선택으로도 성공할 수 있다 (역사 일치가 정답이 아니다)", () => {
    const notRecord = all.filter((p) => STEPS[1].choices[p[1]].tag !== "기록" && STEPS[2].choices[p[2]].tag !== "기록");
    expect(notRecord.some((p) => WIN.includes(simulate(p).ending))).toBe(true);
  });

  it("수치는 0~100을 벗어나지 않는다", () => {
    expect(applyDelta({ wall: 5, food: 95, morale: 50, people: 50 }, { wall: -20, food: 20 })).toMatchObject({ wall: 0, food: 100 });
  });
});

describe("근거 표시", () => {
  it("학생에게 보이는 사실 문장에는 태그가 있다", () => {
    const tagged = /^\[(기록|전승|가정|게임)\]/;
    for (const t of [...INTRO, ...ENDING_RECORD, ...STEPS.flatMap((s) => s.facts), ...Object.values(EVIDENCE).flatMap((c) => c.rows)]) expect(t).toMatch(tagged);
  });

  it("퀴즈의 사료 정답은 하나다", () => {
    expect(QUIZ.options.filter((o) => o.kind === "기록")).toHaveLength(1);
  });
});

function scripted(picks: (number | null)[]) {
  const said: string[] = [];
  const cards: string[] = [];
  let seen = 0;
  const io = {
    say: (t: string) => void said.push(t),
    clear() {}, table() {}, refresh() {}, showBattle() {},
    showOfficer: (id: string) => void cards.push(id),
    pause: async () => {}, sleep: async () => {},
    choose: async (_p: string, o: Option[]) => {
      seen++;
      return picks.length ? picks.shift()! : o[o.length - 1].value;
    },
    number: async () => 0, confirm: async () => true, pickRegion: async () => null, pickHex: async () => null,
  } as IO;
  return { io, said, cards, turns: () => seen };
}

describe("임무 진행", () => {
  it("실패해도 회고까지 간다", async () => {
    const lose = all.find((p) => !WIN.includes(simulate(p).ending))!;
    const { io, said } = scripted([...lose.slice(0, simulate(lose).steps).map((x) => x + 1), 1, 3]);
    await runMission(io);
    expect(said.join()).toContain("실제 기록");
    expect(said.join()).toContain("출처");
  });

  it("다시 하면 시작 수치로 돌아가고 근거 카드를 다시 볼 수 있다", async () => {
    const win = all.find((p) => WIN.includes(simulate(p).ending))!;
    const once = win.map((x) => x + 1);
    const { io, said, cards } = scripted([...once, 2, 2, 1, ...once, 1, 3]);
    await runMission(io);
    expect(said.filter((t) => t.includes("내 결과")).length).toBe(2);
    expect(new Set(said.filter((t) => t.startsWith("내 결과")))).toHaveProperty("size", 1); // 같은 선택이면 같은 결과
    expect(cards).toEqual(expect.arrayContaining(Object.keys(EVIDENCE)));
  });
});
