// AI끼리만 진행하는 헤드리스 시뮬레이션 (런타임 오류·밸런스 점검용)
// 사용법: node sim.mjs <시나리오> <연수> [-v]
import { factionTotals } from "../src/engine/economy";
import { Game } from "../src/engine/game";
import type { IO } from "../src/engine/io";
import { createGame } from "../src/engine/state";
import { FACTION_IDS } from "../src/engine/types";

const scenario = Number(process.argv[2] ?? 1);
const years = Number(process.argv[3] ?? 30);
const verbose = process.argv.includes("-v");
const s = createGame(scenario, [], "history", 2, false);
const endYear = s.year + years;
let lastYear = s.year;

function report() {
  const row = FACTION_IDS.filter((f) => s.factions[f].alive).map((f) => {
    const t = factionTotals(s, f);
    return `${s.factions[f].name}:${t.regions}지역/${t.officers}장/${t.men}병/금${t.gold}/량${t.food}`;
  });
  console.log(s.year, row.join("  "));
}

const io: IO = {
  say: (t) => { if (verbose) console.log(t); },
  clear() {},
  pause: async () => {},
  table() {},
  // 매달 초에 호출되므로 여기서 연도 변화를 감시한다
  refresh() {
    if (s.year !== lastYear) {
      lastYear = s.year;
      report();
      if (s.year >= endYear) s.over = true;
    }
  },
  choose: async (_p, o) => o[0]?.value ?? null,
  number: async (_p, min) => min,
  confirm: async () => true,
  pickRegion: async (_p, a) => a[0] ?? null,
  showBattle() {},
  showOfficer() {},
  pickHex: async (_p, a) => a[0] ?? null,
  sleep: async () => {},
};

report();
await new Game(io, s).run();
report();
console.log("END", s.year, s.month);
