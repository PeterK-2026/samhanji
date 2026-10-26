// 전술 전투용 육각 격자 (odd-r 오프셋: 홀수 행이 반 칸 오른쪽으로 밀림)
import type { Terrain } from "./io";

// 원작 전장은 가로 13칸 (MAIN.EXE의 x + y×13)
export const COLS = 13;
export const ROWS = 15; // 1024×1024 그림에 맞도록 거의 정사각형

export const hexId = (c: number, r: number) => r * COLS + c + 1;
export const colOf = (id: number) => (id - 1) % COLS;
export const rowOf = (id: number) => Math.floor((id - 1) / COLS);

const EVEN: [number, number][] = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const ODD: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];

// 방향 0~5: 동, 북동, 북서, 서, 남서, 남동 (바람 방향에도 쓴다)
export const DIR_NAME = ["동", "북동", "북서", "서", "남서", "남동"];
export const DIR_ARROW = ["→", "↗", "↖", "←", "↙", "↘"];

export function step(id: number, dir: number): number | null {
  const c = colOf(id);
  const r = rowOf(id);
  const [dc, dr] = (r & 1 ? ODD : EVEN)[dir];
  const nc = c + dc;
  const nr = r + dr;
  return nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS ? hexId(nc, nr) : null;
}

export function neighbors(id: number): number[] {
  const out: number[] = [];
  for (let d = 0; d < 6; d++) {
    const n = step(id, d);
    if (n) out.push(n);
  }
  return out;
}

function cube(id: number): [number, number, number] {
  const c = colOf(id);
  const r = rowOf(id);
  const x = c - (r - (r & 1)) / 2;
  return [x, -x - r, r];
}

export function dist(a: number, b: number): number {
  const [ax, ay, az] = cube(a);
  const [bx, by, bz] = cube(b);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

// 원작 MAIN.EXE 지형 표 (docs/01-rtk2-eng-analysis.md §9.3)
// 이동 비용(0xb6cc): 산은 통행 불가
export const MOVE_COST: Record<Terrain, number> = { plain: 2, grass: 3, forest: 3, mountain: 99, river: 5, hill: 3, castle: 3 };
// 방어 지형계수(0xb376): 손실 = … × 10 ÷ 계수. 성에서 출격하는 부대는 5
export const TERRAIN_DIV: Record<Terrain, number> = { plain: 10, grass: 10, forest: 12, mountain: 10, river: 8, hill: 15, castle: 20 };
export const SORTIE_DIV = 5;
// 화계 기본 확률(0xb36e)
export const FIRE_BASE: Record<Terrain, number> = { plain: 80, grass: 90, forest: 70, mountain: 60, river: 0, hill: 50, castle: 20 };
export const TERRAIN_NAME: Record<Terrain, string> = { plain: "평지", grass: "초원", forest: "숲", mountain: "산", river: "강", hill: "구릉", castle: "성" };

// 시드 고정 난수 (같은 지역이면 늘 같은 전장)
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Edge = "east" | "west" | "north" | "south";

export interface Field {
  terrain: Terrain[]; // index = id - 1
  hq: number; // 본성
  castles: number[]; // 본성 포함 모든 성
}

// 지역마다 고정된 전장. 원작처럼 성이 여러 개 있고, 본성은 가운데 근처에 있다.
export function makeField(seed: number, forts: number): Field {
  const R = rng(seed);
  const pick = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
  const terrain: Terrain[] = Array.from({ length: COLS * ROWS }, () => "plain");
  const set = (id: number, t: Terrain) => {
    terrain[id - 1] = t;
  };
  const blob = (t: Terrain, size: number) => {
    let cur = hexId(pick(1, COLS - 2), pick(1, ROWS - 2));
    for (let i = 0; i < size; i++) {
      set(cur, t);
      const ns = neighbors(cur);
      cur = ns[Math.floor(R() * ns.length)];
    }
  };
  for (let i = 0; i < pick(3, 5); i++) blob("grass", pick(3, 7));
  for (let i = 0; i < pick(4, 7); i++) blob("forest", pick(3, 7));
  for (let i = 0; i < 2 + Math.floor(forts / 30); i++) blob("mountain", pick(2, 5));
  for (let i = 0; i < pick(1, 3); i++) blob("hill", pick(1, 3));
  // 강 1~2줄
  for (let k = 0; k < (R() < 0.35 ? 2 : 1); k++) {
    if (R() < 0.5) {
      let c = pick(3, COLS - 4);
      for (let r = 0; r < ROWS; r++) {
        set(hexId(c, r), "river");
        if (R() < 0.45) c = Math.max(1, Math.min(COLS - 2, c + (R() < 0.5 ? -1 : 1)));
      }
    } else {
      let r = pick(2, ROWS - 3);
      for (let c = 0; c < COLS; c++) {
        set(hexId(c, r), "river");
        if (R() < 0.35) r = Math.max(1, Math.min(ROWS - 2, r + (R() < 0.5 ? -1 : 1)));
      }
    }
  }
  // 성: 본성 + 성곽 수치에 따라 1~3개
  const hq = hexId(pick(4, COLS - 5), pick(3, ROWS - 4));
  const castles = [hq];
  const extra = 1 + Math.floor(forts / 40);
  for (let tries = 0; castles.length < 1 + extra && tries < 50; tries++) {
    const h = hexId(pick(1, COLS - 2), pick(1, ROWS - 2));
    if (castles.every((c) => dist(c, h) >= 4)) castles.push(h);
  }
  for (const c of castles) {
    set(c, "castle");
    for (const n of neighbors(c)) if (terrain[n - 1] === "river" || terrain[n - 1] === "mountain") set(n, "plain");
  }
  // 가장자리 한 줄은 지나갈 수 있게
  for (let i = 1; i <= COLS * ROWS; i++) {
    const edge = colOf(i) === 0 || colOf(i) === COLS - 1 || rowOf(i) === 0 || rowOf(i) === ROWS - 1;
    if (edge && terrain[i - 1] === "mountain") terrain[i - 1] = "plain";
  }
  return { terrain, hq, castles };
}

// 출발한 지역 쪽 가장자리의 진입 칸 (원작의 "9" 표시 칸)
export function entryHexes(field: Field, edge: Edge): number[] {
  const out: number[] = [];
  if (edge === "west" || edge === "east") {
    const c = edge === "west" ? 0 : COLS - 1;
    for (let r = 2; r < ROWS - 2; r++) out.push(hexId(c, r));
  } else {
    const r = edge === "north" ? 0 : ROWS - 1;
    for (let c = 3; c < COLS - 3; c++) out.push(hexId(c, r));
  }
  return out.filter((h) => field.terrain[h - 1] !== "castle");
}

// 이동 가능 범위 (다익스트라). 적 부대에 인접한 칸에 들어가면 그 자리에서 멈춘다(견제).
export function reachable(
  start: number, mp: number, field: Field, occupied: Map<number, "atk" | "def">, mySide: "atk" | "def",
  blocked: Set<number>, enterableCastles: Set<number>,
): Map<number, number> {
  const best = new Map<number, number>([[start, 0]]);
  const queue: [number, number][] = [[start, 0]];
  const enemyAdj = (id: number) => neighbors(id).some((n) => occupied.get(n) && occupied.get(n) !== mySide);
  while (queue.length) {
    queue.sort((a, b) => a[1] - b[1]);
    const [cur, cost] = queue.shift()!;
    if (cur !== start && enemyAdj(cur)) continue;
    for (const n of neighbors(cur)) {
      if (occupied.has(n) || blocked.has(n)) continue;
      const t = field.terrain[n - 1];
      if (t === "castle" && !enterableCastles.has(n)) continue;
      if (t === "mountain") continue; // 산은 지날 수 없다
      // 이동력이 모자라도 출발 칸에서 한 칸은 움직일 수 있다 [설계]. 훈련이 낮은 부대가 숲·초원 앞에서 영영 멈추지 않게 한다.
      const nc = cur === start ? Math.min(mp, MOVE_COST[t]) : cost + MOVE_COST[t];
      if (nc > mp) continue;
      if (nc < (best.get(n) ?? Infinity)) {
        best.set(n, nc);
        queue.push([n, nc]);
      }
    }
  }
  best.delete(start);
  return best;
}
