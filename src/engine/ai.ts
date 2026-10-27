import { regionDef } from "../data/regions";
import { sendReinforcement, war } from "./battle";
import { MAX_FOOD } from "./economy";
import type { IO } from "./io";
import {
  adjacent, battleAt, bestBy, chance, clamp, freeOfficersIn, isAllied, menCap, menIn, officersIn, rand, regionOf,
} from "./state";
import type { FactionId, GameState } from "./types";

function defenseStrength(s: GameState, rid: number): number {
  const r = regionOf(s, rid);
  const offs = officersIn(s, rid);
  const men = offs.length ? menIn(s, rid) : Math.floor(r.pop * (r.owner ? 0.02 : 0.01)) * 0.6;
  return men * (1 + r.forts / 100);
}

function isFrontier(s: GameState, rid: number, f: FactionId): boolean {
  return adjacent(rid).some((n) => {
    const o = regionOf(s, n).owner;
    return o !== f && !isAllied(s, f, o);
  });
}

// 중원(한반도 밖) 지역은 서쪽 돌궐·토번에 대비해 장수 2명을 남겨 둔다 [설계].
// 이것이 없으면 당이 중원의 장수를 모두 요동으로 보내 순식간에 고구려를 무너뜨린다.
const garrison = (rid: number) => (regionDef(rid).korea ? 0 : 2);

// 아군 땅만 지나 가장 가까운 전방 지역으로 가는 첫 이웃 (없으면 null)
function stepToFront(s: GameState, rid: number, f: FactionId): number | null {
  const first = new Map<number, number>();
  const q: number[] = [];
  for (const n of adjacent(rid)) {
    if (regionOf(s, n).owner !== f) continue;
    first.set(n, n);
    q.push(n);
  }
  while (q.length) {
    const cur = q.shift()!;
    if (isFrontier(s, cur, f)) return first.get(cur)!;
    for (const n of adjacent(cur)) {
      if (n === rid || first.has(n) || regionOf(s, n).owner !== f) continue;
      first.set(n, first.get(cur)!);
      q.push(n);
    }
  }
  return null;
}

// AI 지역 한 곳의 이번 달 행동 (1개 명령)
export async function aiAct(s: GameState, io: IO, rid: number): Promise<void> {
  const r = regionOf(s, rid);
  const f = r.owner;
  if (!f) return;
  const offs = officersIn(s, rid);
  if (!offs.length) return;
  const men = menIn(s, rid);
  const aggressive = s.factions[f].player ? 0.8 : [0.8, 1, 1.15][s.difficulty - 1];

  // 1) 군량 위기
  if (r.food < men * 0.03 * 3 && r.gold > 100) {
    const buy = Math.min(Math.floor((r.gold * 0.6 * 100) / s.foodPrice), men * 0.03 * 8);
    r.gold -= Math.ceil((buy * s.foodPrice) / 100);
    r.food = Math.min(MAX_FOOD, r.food + Math.floor(buy));
    return;
  }
  // 2) 민심 위기
  if (r.loyalty < 35) {
    if (r.rate > 30) r.rate -= 10;
    if (r.food > men * 0.3) {
      const n = Math.floor(r.food * 0.15);
      r.food -= n;
      r.loyalty = Math.min(100, r.loyalty + Math.ceil((n / r.pop) * 400));
      return;
    }
  }
  // 3) 이어지는 전투에 원군: 맞닿은 곳에서 우리 편이 싸우고 있으면 병력을 보탠다
  const friend = (x: FactionId | null) => !!x && (x === f || isAllied(s, f, x));
  for (const n of adjacent(rid)) {
    const ob = battleAt(s, n);
    if (!ob || !chance(0.5)) continue;
    const side = friend(ob.attacker) ? "atk" : friend(ob.defender) ? "def" : null;
    if (!side) continue;
    const ruler = s.factions[f].ruler;
    const spare = [...offs].filter((o) => o.men >= 800 && o.id !== ruler).sort((a, b) => b.men - a.men);
    const keep = isFrontier(s, rid, f) ? 1 : 0;
    const go = spare.slice(0, Math.max(0, Math.min(3, offs.length - keep)));
    if (!go.length) continue;
    const need = go.reduce((a, o) => a + o.men, 0);
    sendReinforcement(s, n, side, f, rid, go, Math.min(r.food, Math.ceil(need * 1.2)), Math.min(200, Math.floor(r.gold / 4)));
    return;
  }

  // 4) 공격 (다른 나라가 이미 포위 중인 곳은 제외)
  const targets = adjacent(rid)
    .filter((n) => {
      const o = regionOf(s, n).owner;
      return o !== f && !isAllied(s, f, o) && !battleAt(s, n);
    })
    .map((n) => ({ n, d: defenseStrength(s, n) }))
    .sort((a, b) => a.d - b.d);
  const strength = offs.reduce((a, o) => a + o.men * (0.4 + o.war / 150 + o.trn / 250), 0);
  // 출병 기준: 처음엔 수비력의 1.5배를 요구하다가, 싸움 없이 지낸 달이 길어질수록 낮아져 2년이면 1.1배가 된다 [설계].
  // 고정 배수로는 1.2배면 초반 전격전, 1.5배면 끝없는 교착이 되어 둘 사이를 시간으로 잇는다.
  const now = s.year * 12 + s.month;
  s.lastWar ??= {};
  const idle = now - (s.lastWar[f] ??= now);
  const need = 1.5 - 0.4 * Math.min(1, idle / 24);
  for (const t of targets) {
    const enough = strength * aggressive > t.d * need + 900 && r.food > men * 0.7;
    if (enough && chance(0.7)) {
      const sorted = [...offs].filter((o) => o.men > 0).sort((a, b) => b.war - a.war);
      const keep = Math.max(garrison(rid), isFrontier(s, rid, f) && sorted.length > 1 ? 1 : 0);
      const army = sorted.slice(0, Math.max(1, sorted.length - keep)).slice(0, 8);
      // 군주는 위험하면 남는다
      const ruler = s.factions[f].ruler;
      const final = army.length > 1 ? army.filter((o) => o.id !== ruler) : army;
      // 총대장(맨 앞)은 무력·지력·매력이 가장 높은 장수
      final.sort((a, b) => b.war + b.int + b.chr - (a.war + a.int + a.chr));
      const armyMen = final.reduce((a, o) => a + o.men, 0);
      const food = Math.min(r.food, Math.ceil(armyMen * 1.15)); // 원작처럼 한 달 치(병사 1명당 1석)에 여유분
      const gold = Math.min(300, Math.floor(r.gold / 3));
      s.lastWar[f] = now;
      await war(s, io, f, rid, t.n, { officers: final, food, gold });
      return;
    }
  }
  // 4) 재야 인재
  const free = freeOfficersIn(s, rid);
  if (free.length && chance(0.5)) {
    const me = bestBy(offs, "chr")!;
    const t = free[0];
    if (t.hidden) {
      if (chance(0.3 + me.chr / 150)) t.hidden = false;
    } else if (chance(clamp(0.35 + (me.chr - 50) / 100, 0.1, 0.9))) {
      t.faction = f;
      t.loy = rand(65, 85);
    }
    return;
  }
  // 5) 전방이면 징병·훈련
  const frontier = isFrontier(s, rid, f);
  if (frontier) {
    const weakest = [...offs].sort((a, b) => a.men / menCap(a) - b.men / menCap(b))[0];
    const room = menCap(weakest) - weakest.men;
    if (room > 500 && r.gold > 300) {
      const n = Math.min(room, (r.gold - 150) * 2, Math.floor(r.pop * 0.08));
      if (n > 300) {
        weakest.trn = Math.round((weakest.trn * weakest.men + 10 * n) / (weakest.men + n));
        weakest.men += n;
        r.gold -= Math.ceil(n / 2);
        r.pop -= n;
        return;
      }
    }
    const untrained = offs.filter((o) => o.men > 0 && o.trn < 75).sort((a, b) => a.trn - b.trn)[0];
    if (untrained) {
      untrained.trn = Math.min(100, untrained.trn + 5 + Math.floor((untrained.war + untrained.int) / 25));
      return;
    }
  } else {
    // 6) 후방이면 전방 쪽으로 병력 이동. 전방과 바로 붙어 있지 않은 깊은 후방도 아군 땅을 따라 한 칸씩 보낸다.
    const step = stepToFront(s, rid, f);
    const ruler = s.factions[f].ruler;
    const movable = offs.filter((o) => o.id !== ruler && o.men > 500);
    if (step && offs.length > garrison(rid) && movable.length > (offs.length > 1 ? 0 : 1) && chance(0.6)) {
      const dest = step;
      const mover = movable.sort((a, b) => b.men - a.men)[0];
      if (offs.length > 1 || mover.id !== ruler) {
        mover.region = dest;
        const food = Math.min(Math.floor(r.food * 0.3), MAX_FOOD - regionOf(s, dest).food);
        r.food -= food;
        regionOf(s, dest).food += food;
        return;
      }
    }
  }
  // 7) 내정
  if (r.gold > 250) {
    const key = r.land <= r.flood ? "land" : "flood";
    if (r[key] < 100) {
      const g = Math.min(300, r.gold - 100);
      const off = bestBy(offs, "int")!;
      r.gold -= g;
      r[key] = Math.min(100, r[key] + Math.max(1, Math.floor((g / 25) * (0.5 + off.int / 200) * (1 - r[key] / 150))));
      return;
    }
  }
  if (r.loyalty < 55 && r.rate > 35) r.rate -= 5;
  else if (r.loyalty > 75 && r.rate < 55) r.rate += 5;
}
