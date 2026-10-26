// 새 게임 상태가 처음부터 불변식을 지키는지
import { describe, expect, it } from "vitest";
import { SCENARIOS } from "../src/data/scenarios";
import { checkInvariants } from "../src/dev/check";
import { seedRandom } from "../src/dev/seed";
import { createGame } from "../src/engine/state";
import { FACTION_IDS } from "../src/engine/types";

function seeded<T>(seed: number, fn: () => T): T {
  const restore = seedRandom(seed);
  try {
    return fn();
  } finally {
    restore();
  }
}

describe.each(SCENARIOS.map((sc) => [sc.id, sc.year] as const))("시나리오 %i (%i년) 시작 상태", (id) => {
  it.each([1, 2, 3])("시드 %i: 불변식 위반이 없다", (seed) => {
    expect(seeded(seed, () => checkInvariants(createGame(id, [], "history", 2, false)))).toEqual([]);
  });
  it("살아 있는 세력마다 장수가 있고 장수 없는 영토가 거의 없다", () => {
    const s = createGame(id, [], "history", 2, false);
    for (const f of FACTION_IDS.filter((x) => s.factions[x].alive)) {
      expect(Object.values(s.officers).some((o) => o.faction === f && o.alive)).toBe(true);
    }
    const empty = s.regions.filter((r) => r.owner && !Object.values(s.officers).some((o) => o.alive && o.region === r.id && o.faction === r.owner));
    expect(empty.length).toBeLessThanOrEqual(2);
  });
  it("같은 시드면 같은 상태가 나온다", () => {
    const make = () => seeded(7, () => createGame(id, ["silla"], "history", 2, false));
    expect(make()).toEqual(make());
  });
});
