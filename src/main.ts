import { SCENARIOS } from "./data/scenarios";
import { DEBUG, DebugPanel } from "./dev/debug";
import { Game, type RunResult } from "./engine/game";
import { createGame } from "./engine/state";
import { FACTION_IDS, type FactionId, type GameState, type Mode } from "./engine/types";
import { listSaves, loadGame } from "./save";
import { UI } from "./ui/ui";

const ui = new UI(document.getElementById("app")!);
const debug = DEBUG ? new DebugPanel(ui) : null; // ?debug (src/dev/debug.ts)

async function setup(): Promise<GameState | null> {
  const quick = debug?.quickStart();
  if (quick) return quick;
  ui.setState(createGame(1, [], "history", 2, false), true); // 타이틀: 642년 세력도를 미리 보여 준다
  ui.clear();
  ui.scene("title");
  ui.say("삼한지 三韓志 — 고구려·백제·신라, 그리고 당");
  ui.say("7세기, 한반도의 패권을 두고 네 나라가 맞선다.");
  const start = await ui.choose("무엇을 하시겠습니까?", [
    { value: 1, label: "새로 시작" }, { value: 2, label: "불러오기" },
  ], { columns: 2 });
  if (start === 2) {
    const slot = await ui.choose("어느 칸을 불러옵니까?",
      listSaves().map((x) => ({ value: x.slot, label: `${x.slot}. ${x.label}` })), { cancel: true, columns: 1 });
    if (!slot) return null;
    const st = loadGame(slot);
    if (!st) {
      ui.say("불러올 수 없습니다.");
      return null;
    }
    return st;
  }

  ui.clear();
  for (const sc of SCENARIOS) ui.say(`${sc.id}. ${sc.title} (${sc.year}년) — ${sc.summary}`);
  const scId = await ui.choose("시나리오를 고르십시오", SCENARIOS.map((sc) => ({ value: sc.id, label: `${sc.title} ${sc.year}년` })), { columns: 2, cancel: true });
  if (!scId) return null;
  const sc = SCENARIOS.find((x) => x.id === scId)!;
  const preview = createGame(scId, [], "history", 2, false);
  ui.setState(preview);

  const available = FACTION_IDS.filter((f) => sc.rulers[f]);
  const count = await ui.choose("플레이어 수는? (0 = 관전)", Array.from({ length: available.length + 1 }, (_, i) => ({ value: i, label: ["관전", "한 명", "두 명", "세 명", "네 명"][i] })), { columns: 5 });
  const players: FactionId[] = [];
  for (let i = 0; i < (count ?? 1); i++) {
    const left = available.filter((f) => !players.includes(f));
    ui.clear();
    for (const [n, f] of left.entries()) {
      const ruler = preview.officers[sc.rulers[f]!];
      const regions = preview.regions.filter((r) => r.owner === f).length;
      ui.say(`${n + 1}. ${preview.factions[f].name} — 군주 ${ruler.name} · ${regions}개 지역`);
    }
    const pick = await ui.choose(`플레이어 ${i + 1}, 어느 나라를 맡겠습니까?`,
      left.map((f, n) => ({ value: n + 1, label: preview.factions[f].name })), { columns: 2 });
    players.push(left[(pick ?? 1) - 1]);
  }

  const diff = ((await ui.choose("난이도", [{ value: 1, label: "초급" }, { value: 2, label: "중급" }, { value: 3, label: "상급" }])) ?? 2) as 1 | 2 | 3;
  const watch = await ui.confirm("다른 세력끼리의 전투도 보시겠습니까?");
  const mode: Mode = (await ui.choose("게임 모드", [
    { value: 1, label: "역사 모드 (실제 생몰년)" }, { value: 2, label: "가상 모드 (수명 연장)" },
  ], { columns: 1 })) === 2 ? "fiction" : "history";

  ui.clear();
  ui.say(`시나리오: ${sc.title} (${sc.year}년)`);
  ui.say(`플레이어: ${players.map((f) => preview.factions[f].name).join(", ") || "없음 (관전)"}`);
  ui.say(`난이도: ${["초급", "중급", "상급"][diff - 1]} · ${mode === "history" ? "역사" : "가상"} 모드 · 다른 전투 ${watch ? "보기" : "안 보기"}`);
  if (!(await ui.confirm("이대로 시작합니까?"))) return null;
  return createGame(scId, players, mode, diff, watch || players.length === 0);
}

async function main() {
  let next: GameState | null = null;
  for (;;) {
    const st: GameState | null = next ?? (await setup());
    next = null;
    if (!st) continue;
    debug?.attach(st);
    ui.setState(st);
    const res: RunResult = await new Game(ui, st).run();
    if (res.kind === "load") next = res.state;
  }
}

void main();

// 개발 중 디버깅용
if (import.meta.env.DEV) (window as unknown as { __ui: UI }).__ui = ui;
