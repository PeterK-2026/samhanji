// 달을 넘기는 공방전: 30일로 끝나지 않고 이어지며, 원군이 합류하고, 상태가 깨지지 않는다
import { describe, expect, it } from "vitest";
import { runHeadless } from "../src/dev/headless";

describe("이어지는 공방전", () => {
  it("전투가 다음 달로 이어지고 원군이 도착하며 불변식이 지켜진다", async () => {
    const seen = { carried: 0, resumed: 0, arrivals: 0, timeout: 0 };
    const problems: string[] = [];
    for (const seed of [1, 2, 3]) {
      const r = await runHeadless({ scenario: 1, years: 10, seed, showBattles: true, log: (t) => {
        if (t.includes("다음 달에 이어 싸운다")) seen.carried++;
        if (t.startsWith("【공방전")) seen.resumed++;
        if (t.includes("원군으로 도착")) seen.arrivals++;
        if (t.includes("30일이 지났다")) seen.timeout++;
      } });
      problems.push(...(r.error ? [r.error] : []), ...r.violations);
    }
    expect(problems.slice(0, 5)).toEqual([]);
    expect(seen.timeout).toBe(0); // 30일 시간 초과로 끝나는 전투는 없다
    expect(seen.carried).toBeGreaterThan(0);
    expect(seen.resumed).toBeGreaterThan(0);
    expect(seen.arrivals).toBeGreaterThan(0);
  });
});
