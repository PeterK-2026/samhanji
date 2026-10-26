// 육각 전장 기하와 지역별 전장 생성
import { describe, expect, it } from "vitest";
import { REGION_DEFS } from "../src/data/regions";
import { COLS, ROWS, dist, entryHexes, makeField, neighbors, reachable, step, type Edge } from "../src/engine/hex";

const ALL = Array.from({ length: COLS * ROWS }, (_, i) => i + 1);

describe("육각 좌표", () => {
  it("이웃 관계가 대칭이고 거리 1이다", () => {
    for (const a of ALL) {
      for (const b of neighbors(a)) {
        expect(neighbors(b)).toContain(a);
        expect(dist(a, b)).toBe(1);
      }
    }
  });
  it("반대 방향으로 한 칸 가면 제자리로 돌아온다", () => {
    for (const a of ALL) {
      for (let d = 0; d < 6; d++) {
        const b = step(a, d);
        if (b) expect(step(b, (d + 3) % 6)).toBe(a);
      }
    }
  });
  it("거리는 삼각 부등식을 만족한다", () => {
    for (let a = 1; a <= ALL.length; a += 7) {
      for (let b = 1; b <= ALL.length; b += 11) {
        for (let c = 1; c <= ALL.length; c += 13) expect(dist(a, c)).toBeLessThanOrEqual(dist(a, b) + dist(b, c));
      }
    }
  });
});

describe.each(REGION_DEFS.map((d) => [d.id, d.name, d] as const))("전장 %i %s", (_id, _n, d) => {
  const f = makeField(d.id * 977 + 31, d.forts);
  it("같은 시드면 같은 전장이 나온다", () => {
    expect(makeField(d.id * 977 + 31, d.forts)).toEqual(f);
  });
  it("본성이 성 목록에 있고 성 칸이다", () => {
    expect(f.castles).toContain(f.hq);
    for (const c of f.castles) expect(f.terrain[c - 1]).toBe("castle");
  });
  it.each(["east", "west", "north", "south"] as Edge[])("%s 진입 칸에서 본성 옆까지 걸어갈 수 있다", (edge) => {
    const entries = entryHexes(f, edge);
    expect(entries.length).toBeGreaterThan(0);
    const goal = new Set(neighbors(f.hq));
    const ok = entries.some((e) => goal.has(e) || [...reachable(e, 9999, f, new Map(), "atk", new Set(), new Set()).keys()].some((h) => goal.has(h)));
    expect(ok).toBe(true);
  });
});
