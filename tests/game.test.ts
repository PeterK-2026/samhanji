// 화면 없이 게임을 몇 년씩 돌려 런타임 오류·무한 루프·상태 오염을 잡는다
import { describe, expect, it } from "vitest";
import { SCENARIOS } from "../src/data/scenarios";
import { runHeadless, type RunResult } from "../src/dev/headless";
import type { FactionId } from "../src/engine/types";

const problems = (r: RunResult) => [r.error, ...r.violations.slice(0, 10)].filter(Boolean).join("\n");

describe("AI 대 AI", () => {
  it.each(SCENARIOS.flatMap((sc) => [1, 2].map((seed) => [sc.id, seed] as const)))("시나리오 %i 시드 %i: 8년 진행", async (scenario, seed) => {
    const r = await runHeadless({ scenario, years: 8, seed });
    expect(problems(r)).toBe("");
    expect(r.months).toBeGreaterThanOrEqual(8 * 12);
  });
  it("같은 시드면 결과가 같다 (재현성)", async () => {
    const a = await runHeadless({ scenario: 1, years: 4, seed: 99 });
    const b = await runHeadless({ scenario: 1, years: 4, seed: 99 });
    expect(a.history).toEqual(b.history);
    expect(a.final).toEqual(b.final);
  });
});

describe("몽키 테스트: 플레이어 선택을 무작위로", () => {
  const cases: [number, FactionId, number][] = [
    [1, "silla", 1], [1, "goguryeo", 2], [2, "baekje", 3], [2, "tang", 4], [3, "silla", 5], [4, "silla", 6],
  ];
  it.each(cases)("시나리오 %i %s 시드 %i: 3년 진행", async (scenario, f, seed) => {
    const r = await runHeadless({ scenario, years: 3, seed, players: [f], monkey: true });
    expect(problems(r)).toBe("");
  });
});
