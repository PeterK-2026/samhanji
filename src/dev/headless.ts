// 화면 없이 게임을 돌리는 자동 IO와 실행기. Vitest 테스트와 scripts/eval.ts가 쓴다.
//  - "ai": 플레이어 없이 AI끼리만 진행 (밸런스 평가)
//  - "monkey": 플레이어 세력을 두고 모든 선택을 무작위로 고른다 (명령·전투 화면 코드의 퍼즈 테스트)
import { factionTotals } from "../engine/economy";
import { Game } from "../engine/game";
import type { IO } from "../engine/io";
import { victor } from "../engine/politics";
import { createGame } from "../engine/state";
import { FACTION_IDS, type FactionId, type Mode } from "../engine/types";
import { checkInvariants } from "./check";
import { seedRandom } from "./seed";

export interface RunOptions {
  scenario: number;
  years: number;
  seed: number;
  players?: FactionId[]; // 비우면 AI끼리
  monkey?: boolean; // 플레이어 선택을 무작위로
  mode?: Mode;
  difficulty?: 1 | 2 | 3;
  maxCallsPerMonth?: number; // 한 달에 IO 호출이 이보다 많으면 무한 루프로 본다
  log?: (t: string) => void;
}

export interface Snapshot {
  year: number;
  month: number;
  regions: Record<FactionId, number>;
}

export interface RunResult {
  scenario: number;
  seed: number;
  startYear: number;
  endYear: number;
  endMonth: number;
  months: number;
  winner: FactionId | null; // 삼한 통일
  winYear: number | null;
  destroyed: Partial<Record<FactionId, number>>; // 멸망 연도
  captures: number; // 지역 주인이 바뀐 횟수
  ioCalls: number;
  final: Record<FactionId, { alive: boolean; regions: number; officers: number; men: number; gold: number; food: number }>;
  history: Snapshot[]; // 매년 1월 영토
  violations: string[]; // 처음 발견된 불변식 위반 (중복 제거, 최대 50개)
  error: string | null;
  ms: number;
}

export async function runHeadless(opt: RunOptions): Promise<RunResult> {
  const restore = seedRandom(opt.seed);
  const t0 = performance.now();
  const s = createGame(opt.scenario, opt.players ?? [], opt.mode ?? "history", opt.difficulty ?? 2, false);
  const startYear = s.year;
  const endYear = s.year + opt.years;
  const maxCalls = opt.maxCallsPerMonth ?? 20000;
  const res: RunResult = {
    scenario: opt.scenario, seed: opt.seed, startYear, endYear: s.year, endMonth: s.month, months: 0,
    winner: null, winYear: null, destroyed: {}, captures: 0, ioCalls: 0,
    final: {} as RunResult["final"], history: [], violations: [], error: null, ms: 0,
  };
  const seen = new Set<string>();
  let owners = s.regions.map((r) => r.owner);
  let lastKey = "";
  let monthCalls = 0;

  const rnd = (n: number) => Math.floor(Math.random() * n);
  const tick = () => {
    res.ioCalls++;
    if (++monthCalls > maxCalls) throw new Error(`${s.year}년 ${s.month}월: 한 달에 IO 호출 ${maxCalls}회 초과 (무한 루프 의심)`);
  };
  const snapshot = (): Snapshot => ({
    year: s.year, month: s.month,
    regions: Object.fromEntries(FACTION_IDS.map((f) => [f, s.regions.filter((r) => r.owner === f).length])) as Record<FactionId, number>,
  });
  // 매달 초 refresh()에서 상태를 점검한다
  const onMonth = () => {
    const key = `${s.year}-${s.month}`;
    if (key === lastKey) return;
    lastKey = key;
    res.months++;
    monthCalls = 0;
    for (const [i, r] of s.regions.entries()) if (r.owner !== owners[i]) res.captures++;
    owners = s.regions.map((r) => r.owner);
    if (s.month === 1) res.history.push(snapshot());
    for (const v of checkInvariants(s)) {
      if (seen.has(v) || res.violations.length >= 50) continue;
      seen.add(v);
      res.violations.push(`${s.year}년 ${s.month}월 ${v}`);
    }
    if (s.year >= endYear) s.over = true;
  };

  const monkey = !!opt.monkey;
  const io: IO = {
    say: (t) => opt.log?.(t),
    clear() {},
    pause: async () => tick(),
    table() {},
    refresh() {
      onMonth();
    },
    choose: async (_p, o, c) => {
      tick();
      if (!monkey) return o[0]?.value ?? null;
      if (c?.cancel && Math.random() < 0.1) return null;
      return o.length ? o[rnd(o.length)].value : null;
    },
    number: async (_p, min, max) => {
      tick();
      if (!monkey) return min;
      return Math.random() < 0.3 ? max : min + rnd(max - min + 1);
    },
    confirm: async () => {
      tick();
      return monkey ? Math.random() < 0.6 : true;
    },
    pickRegion: async (_p, a) => {
      tick();
      if (!monkey) return a[0] ?? null;
      return a.length && Math.random() < 0.9 ? a[rnd(a.length)] : null;
    },
    showBattle() {},
    showOfficer() {},
    pickHex: async (_p, a) => {
      tick();
      if (!monkey) return a[0] ?? null;
      return a.length && Math.random() < 0.95 ? a[rnd(a.length)] : null;
    },
    sleep: async () => {},
  };

  const aliveAtStart = new Set(FACTION_IDS.filter((f) => s.factions[f].alive));
  try {
    await new Game(io, s).run();
  } catch (e) {
    res.error = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
  } finally {
    restore();
  }
  res.destroyed = {};
  for (const f of FACTION_IDS) if (aliveAtStart.has(f) && !s.factions[f].alive) res.destroyed[f] = destroyedYear(res.history, f, s.year);
  const v = victor(s);
  if (v) {
    res.winner = v;
    res.winYear = s.year;
  }
  res.endYear = s.year;
  res.endMonth = s.month;
  for (const f of FACTION_IDS) {
    const t = factionTotals(s, f);
    res.final[f] = { alive: s.factions[f].alive, regions: t.regions, officers: t.officers, men: t.men, gold: t.gold, food: t.food };
  }
  res.ms = Math.round(performance.now() - t0);
  return res;
}

// 연초 기록에서 영토가 0이 된 첫 해 (기록에 없으면 마지막 해)
function destroyedYear(history: Snapshot[], f: FactionId, last: number): number {
  return history.find((h) => h.regions[f] === 0)?.year ?? last;
}
