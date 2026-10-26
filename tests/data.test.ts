// 데이터 무결성: 인물·지역·시나리오 정의가 서로 맞물리는지
import { describe, expect, it } from "vitest";
import { OFFICER_DEFS } from "../src/data/officers";
import { ADJ, REGION_DEFS } from "../src/data/regions";
import { HEIRS, SCENARIOS } from "../src/data/scenarios";
import { FACTION_IDS } from "../src/engine/types";

const ids = new Set(OFFICER_DEFS.map((d) => d.id));
const byId = new Map(OFFICER_DEFS.map((d) => [d.id, d]));

describe("인물 정의", () => {
  it("id가 겹치지 않는다", () => {
    expect(ids.size).toBe(OFFICER_DEFS.length);
  });
  it("이름이 겹치지 않는다", () => {
    const names = OFFICER_DEFS.map((d) => d.name);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });
  it.each(OFFICER_DEFS.map((d) => [d.id, d] as const))("%s: 능력치·생몰년·소속이 올바르다", (_id, d) => {
    for (const v of [d.int, d.war, d.chr]) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(d.born).toBeLessThan(d.died);
    expect(d.died - d.born).toBeLessThanOrEqual(95);
    expect(FACTION_IDS).toContain(d.home);
  });
});

describe("지역 정의", () => {
  it("id가 1부터 차례대로다", () => {
    REGION_DEFS.forEach((r, i) => expect(r.id).toBe(i + 1));
  });
  it("인접 관계가 양방향이고 자기 자신을 가리키지 않는다", () => {
    for (const [a, ns] of ADJ) {
      expect(ns).not.toContain(a);
      for (const b of ns) expect(ADJ.get(b)).toContain(a);
    }
  });
  it("모든 지역이 하나로 이어져 있다", () => {
    const seen = new Set([1]);
    const q = [1];
    while (q.length) {
      for (const n of ADJ.get(q.shift()!)!) {
        if (!seen.has(n)) {
          seen.add(n);
          q.push(n);
        }
      }
    }
    expect(seen.size).toBe(REGION_DEFS.length);
  });
});

describe.each(SCENARIOS.map((sc) => [sc.id, sc] as const))("시나리오 %i", (_id, sc) => {
  const placed = Object.values(sc.placements).flat();
  it("배치된 장수가 모두 존재하고 한 번씩만 나온다", () => {
    expect(placed.filter((id) => !ids.has(id))).toEqual([]);
    expect(new Set(placed).size).toBe(placed.length);
  });
  it("군주가 자기 나라 땅에 배치되어 있다", () => {
    for (const [f, ruler] of Object.entries(sc.rulers)) {
      const rid = Object.entries(sc.placements).find(([, list]) => list.includes(ruler!))?.[0];
      expect(rid, `${f} 군주 ${ruler}`).toBeDefined();
      expect(sc.owners[Number(rid)]).toBe(f);
    }
  });
  // 시작 연도에 죽는 인물은 허용한다 (사망 연도 하반기부터 자연사)
  it("배치 장수가 시나리오 연도에 태어나 있고 이미 죽지 않았다", () => {
    expect(placed.filter((id) => sc.year < byId.get(id)!.born || sc.year > byId.get(id)!.died)).toEqual([]);
  });
  it("absent·후계자 id가 존재한다", () => {
    expect(sc.absent.filter((id) => !ids.has(id))).toEqual([]);
    expect(Object.values(HEIRS).flat().filter((id) => !ids.has(id))).toEqual([]);
  });
});
