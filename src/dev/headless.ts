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
  showBattles?: boolean; // 다른 세력 전투도 기록(log)으로 받는다
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

// 한 해의 사건 (달력 기준, 끝나지 않은 마지막 해는 뺌)
export interface YearStat {
  year: number;
  wars: number; // 새 출병
  captures: number; // 지역 점령
  changed: number; // 연초와 주인이 달라진 지역 수
}

export interface RunResult {
  scenario: number;
  seed: number;
  startYear: number;
  endYear: number;
  endMonth: number;
  months: number;
  winner: FactionId | null; // 삼한 통일
  judged: FactionId | null; // 시대의 끝 판정
  winYear: number | null;
  destroyed: Partial<Record<FactionId, number>>; // 멸망 연도
  captures: number; // 지역 점령 횟수
  recaptures: number; // 그중 12개월 안에 빼앗겼던 땅을 되찾은 횟수
  wars: number; // 새 출병 횟수
  battles: number; // 승부가 난 전투 수
  atkWins: number; // 그중 공격측 승리
  battleMonths: number; // 승부가 난 전투의 개월 수 합
  years: YearStat[];
  falls: Partial<Record<FactionId, "conquest" | "heirless">>; // 멸망 원인
  extinctYear: number | null; // 모든 세력이 사라진 해
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
  const s = createGame(opt.scenario, opt.players ?? [], opt.mode ?? "history", opt.difficulty ?? 2, !!opt.showBattles);
  const startYear = s.year;
  const endYear = s.year + opt.years;
  const maxCalls = opt.maxCallsPerMonth ?? 20000;
  const res: RunResult = {
    scenario: opt.scenario, seed: opt.seed, startYear, endYear: s.year, endMonth: s.month, months: 0,
    winner: null, judged: null, winYear: null, destroyed: {}, captures: 0, recaptures: 0, wars: 0, battles: 0, atkWins: 0, battleMonths: 0, years: [], falls: {}, extinctYear: null, ioCalls: 0,
    final: {} as RunResult["final"], history: [], violations: [], error: null, ms: 0,
  };
  const seen = new Set<string>();
  let yearOwners = s.regions.map((r) => r.owner);
  let cur: YearStat = { year: s.year, wars: 0, captures: 0, changed: 0 };
  const lost = new Map<number, { from: FactionId; at: number }>(); // 지역별 마지막으로 빼앗긴 세력과 때
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
    if (s.year !== cur.year) {
      cur.changed = s.regions.filter((r, i) => r.owner !== yearOwners[i]).length;
      res.years.push(cur);
      cur = { year: s.year, wars: 0, captures: 0, changed: 0 };
      yearOwners = s.regions.map((r) => r.owner);
    }
    if (res.extinctYear === null && !FACTION_IDS.some((f) => s.factions[f].alive)) res.extinctYear = s.year;
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
    confirm: async (p) => {
      tick();
      if (p.includes("타이틀로")) return false; // 몽키가 게임을 스스로 끝내면 진행을 시험하지 못한다
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
    event(e) {
      if (e.kind === "war") {
        res.wars++;
        cur.wars++;
      } else if (e.kind === "battleEnd") {
        res.battles++;
        res.battleMonths += e.months;
        if (e.atkWon) res.atkWins++;
      } else {
        res.captures++;
        cur.captures++;
        const now = s.year * 12 + s.month;
        const prev = lost.get(e.region);
        if (prev && prev.from === e.to && now - prev.at <= 12) res.recaptures++;
        if (e.from) lost.set(e.region, { from: e.from, at: now });
      }
    },
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
  for (const f of FACTION_IDS) {
    const cause = s.factions[f].fallCause;
    if (cause) res.falls[f] = cause;
  }
  res.judged = s.judged ?? null;
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
