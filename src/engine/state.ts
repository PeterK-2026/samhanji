import { OFFICER_DEFS } from "../data/officers";
import { EXTRA_OFFICER_DEFS } from "../data/officers-extra";
import { ADJ, REGION_DEFS, regionDef } from "../data/regions";
import { FACTION_INFO, SCENARIOS } from "../data/scenarios";
import {
  FACTION_IDS, pairKey,
  type Faction, type FactionId, type GameState, type Mode, type Officer, type Region,
} from "./types";

export const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
export const chance = (p: number) => Math.random() < p;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const FACTION_MULT: Record<FactionId, { men: number; horses: number }> = {
  goguryeo: { men: 1.3, horses: 1.6 },
  baekje: { men: 1.0, horses: 0.8 },
  silla: { men: 1.0, horses: 0.9 },
  tang: { men: 1.4, horses: 1.4 },
};

export function createGame(
  scenarioId: number, players: FactionId[], mode: Mode,
  difficulty: 1 | 2 | 3, showOtherBattles: boolean,
): GameState {
  const sc = SCENARIOS.find((s) => s.id === scenarioId)!;

  const factions = {} as Record<FactionId, Faction>;
  for (const id of FACTION_IDS) {
    factions[id] = {
      id,
      name: sc.factionNames?.[id] ?? FACTION_INFO[id].name,
      ruler: sc.rulers[id] ?? null,
      alive: !!sc.rulers[id],
      player: players.includes(id),
    };
  }

  const regions: Region[] = REGION_DEFS.map((d) => {
    const owner = sc.owners[d.id] ?? null;
    const alive = owner && factions[owner].alive ? owner : null;
    const mult = alive ? FACTION_MULT[alive] : { men: 1, horses: 1 };
    return {
      id: d.id,
      name: d.name,
      owner: alive,
      pop: d.pop,
      gold: Math.round(d.pop / 100 + 300),
      food: Math.round(d.pop / 5),
      rate: 40,
      loyalty: 60,
      land: d.land,
      flood: d.flood,
      horses: Math.round((d.pop / 1000) * 10 * mult.horses),
      forts: d.forts,
      delegated: false,
      spiedBy: [],
    };
  });

  const officers: Record<string, Officer> = {};
  const spawned: string[] = [];
  const placed = new Map<string, number>();
  for (const [rid, ids] of Object.entries(sc.placements)) {
    for (const id of ids) placed.set(id, Number(rid));
  }

  for (const def of OFFICER_DEFS) {
    const age = sc.year - def.born;
    const rid = placed.get(def.id);
    if (rid === undefined) continue;
    const owner = regions[rid - 1].owner;
    const isRuler = owner !== null && factions[owner].ruler === def.id;
    const mult = owner ? FACTION_MULT[owner].men : 1;
    officers[def.id] = {
      id: def.id, name: def.name, born: def.born, died: def.died,
      int: def.int, war: def.war, chr: def.chr,
      loy: isRuler ? 100 : def.loy ?? rand(75, 95),
      men: Math.round(((500 + def.war * 25 + (isRuler ? 1500 : 0)) * mult) / 100) * 100,
      trn: Math.min(100, 40 + Math.floor(def.war / 3)),
      arm: Math.min(100, 30 + Math.floor(def.war / 4)),
      faction: owner,
      region: rid,
      hidden: false,
      alive: age >= 0,
    };
    spawned.push(def.id);
  }
  for (const id of sc.absent) if (!spawned.includes(id)) spawned.push(id);

  // 추가 인물(officers-extra.ts): 시나리오에 자리가 정해지지 않았으면 그 시대에 활동 중인 인물을
  // 자기 나라의 장수가 가장 적은 지역부터 배치한다. 승려·학자(free)는 재야로 남는다.
  const count = new Map<number, number>();
  for (const o of Object.values(officers)) count.set(o.region, (count.get(o.region) ?? 0) + 1);
  for (const def of EXTRA_OFFICER_DEFS) {
    if (spawned.includes(def.id) || def.free) continue;
    if (sc.year - def.born < 16 || sc.year >= def.died) continue;
    const home = factions[def.home];
    const own = regions.filter((r) => r.owner === def.home);
    if (!home.alive || !own.length) continue;
    const r = [...own].sort((a, b) => (count.get(a.id) ?? 0) - (count.get(b.id) ?? 0) || a.id - b.id)[0];
    count.set(r.id, (count.get(r.id) ?? 0) + 1);
    const mult = FACTION_MULT[def.home].men;
    officers[def.id] = {
      id: def.id, name: def.name, born: def.born, died: def.died,
      int: def.int, war: def.war, chr: def.chr,
      loy: def.loy ?? rand(70, 90),
      men: Math.round(((300 + def.war * 20) * mult) / 100) * 100,
      trn: Math.min(100, 35 + Math.floor(def.war / 3)),
      arm: Math.min(100, 25 + Math.floor(def.war / 4)),
      faction: def.home,
      region: r.id,
      hidden: false,
      alive: true,
    };
    spawned.push(def.id);
  }

  const relations: Record<string, number> = {};
  for (let i = 0; i < FACTION_IDS.length; i++) {
    for (let j = i + 1; j < FACTION_IDS.length; j++) {
      relations[pairKey(FACTION_IDS[i], FACTION_IDS[j])] = 30;
    }
  }
  for (const [a, b, v] of sc.relations) relations[pairKey(a, b)] = v;

  const state: GameState = {
    version: 1,
    scenarioId,
    year: sc.year,
    month: 1,
    mode,
    difficulty,
    showOtherBattles,
    regions,
    officers,
    spawned,
    factions,
    relations,
    alliances: sc.alliances.map(([a, b]) => pairKey(a, b)),
    queue: [],
    foodPrice: 10,
    over: false,
  };
  spawnFreeOfficers(state);
  return state;
}

// 아직 등장하지 않은 인물 중 성인이 된 사람을 재야 장수로 등장시킨다.
export function spawnFreeOfficers(state: GameState): Officer[] {
  const out: Officer[] = [];
  for (const def of OFFICER_DEFS) {
    if (state.spawned.includes(def.id)) continue;
    if (state.year >= def.died) {
      state.spawned.push(def.id);
      continue;
    }
    if (state.year - def.born < 16) continue;
    let candidates = state.regions.filter((r) => r.owner === def.home);
    if (candidates.length === 0) candidates = state.regions.filter((r) => regionDef(r.id).korea);
    const region = candidates[rand(0, candidates.length - 1)];
    const off: Officer = {
      id: def.id, name: def.name, born: def.born, died: def.died,
      int: def.int, war: def.war, chr: def.chr,
      loy: def.loy ?? 70, men: 0,
      trn: 30, arm: 30,
      faction: null, region: region.id, hidden: true, alive: true,
    };
    state.officers[def.id] = off;
    state.spawned.push(def.id);
    out.push(off);
  }
  return out;
}

// ── 조회 함수 ──
export const regionOf = (s: GameState, id: number) => s.regions[id - 1];
export const officersIn = (s: GameState, rid: number) =>
  Object.values(s.officers).filter((o) => o.alive && o.region === rid && o.faction !== null && o.faction === regionOf(s, rid).owner);
export const freeOfficersIn = (s: GameState, rid: number) =>
  Object.values(s.officers).filter((o) => o.alive && o.region === rid && o.faction === null);
export const menIn = (s: GameState, rid: number) => officersIn(s, rid).reduce((a, o) => a + o.men, 0);
export const regionsOf = (s: GameState, f: FactionId) => s.regions.filter((r) => r.owner === f);
export const factionOfficers = (s: GameState, f: FactionId) =>
  Object.values(s.officers).filter((o) => o.alive && o.faction === f);
export const adjacent = (id: number) => ADJ.get(id) ?? [];
export const age = (s: GameState, o: Officer) => s.year - o.born;

export function isAllied(s: GameState, a: FactionId | null, b: FactionId | null): boolean {
  if (!a || !b || a === b) return false;
  return s.alliances.includes(pairKey(a, b));
}
export function relation(s: GameState, a: FactionId, b: FactionId): number {
  return s.relations[pairKey(a, b)] ?? 30;
}
export function changeRelation(s: GameState, a: FactionId, b: FactionId, d: number) {
  const k = pairKey(a, b);
  s.relations[k] = clamp((s.relations[k] ?? 30) + d, 0, 100);
}
export function breakAlliance(s: GameState, a: FactionId, b: FactionId) {
  s.alliances = s.alliances.filter((k) => k !== pairKey(a, b));
}

export function capitalOf(s: GameState, f: FactionId): number | null {
  const ruler = s.factions[f].ruler;
  const r = ruler ? s.officers[ruler] : undefined;
  // 군주가 포로로 잡혀 있거나 전투 정리 중이면 군주 위치가 남의 땅일 수 있다
  if (r?.alive && r.faction === f && regionOf(s, r.region).owner === f) return r.region;
  return regionsOf(s, f)[0]?.id ?? null;
}

export function bestBy(list: Officer[], key: "int" | "war" | "chr"): Officer | undefined {
  return list.reduce<Officer | undefined>((b, o) => (!b || o[key] > b[key] ? o : b), undefined);
}

export function menCap(o: Officer): number {
  return 2000 + o.war * 50;
}

// 자기 영토만 지나 도달할 수 있는 지역 (수송용)
export function connectedOwn(s: GameState, from: number): number[] {
  const owner = regionOf(s, from).owner;
  const seen = new Set([from]);
  const q = [from];
  while (q.length) {
    const cur = q.shift()!;
    for (const n of adjacent(cur)) {
      if (!seen.has(n) && regionOf(s, n).owner === owner) {
        seen.add(n);
        q.push(n);
      }
    }
  }
  seen.delete(from);
  return [...seen];
}

export function seasonName(month: number): string {
  return month <= 3 ? "봄" : month <= 6 ? "여름" : month <= 9 ? "가을" : "겨울";
}
