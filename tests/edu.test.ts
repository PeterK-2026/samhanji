// 교육용 공개 전 규칙: 처형 없음, 역사 표현, 사건으로 죽은 인물의 수명
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCENARIOS } from "../src/data/scenarios";
import { lifespanEnd } from "../src/data/officers";
import { seedRandom } from "../src/dev/seed";
import { monthStart } from "../src/engine/economy";
import { succeed } from "../src/engine/politics";
import { createGame, officersIn } from "../src/engine/state";

describe("포로", () => {
  it("엔진 어디에도 처형 선택지가 없다", () => {
    for (const f of readdirSync("src/engine")) {
      const code = readFileSync(`src/engine/${f}`, "utf-8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
      expect(code.includes("처형"), f).toBe(false);
    }
  });

  it("폐위된 군주는 살아 있고 후계가 잇는다", () => {
    const s = createGame(1, [], "history", 2, false);
    const old = s.officers[s.factions.silla.ruler!];
    old.faction = null;
    const msgs = succeed(s, "silla", old, true);
    expect(old.alive).toBe(true);
    expect(s.factions.silla.ruler).not.toBe(old.id);
    expect(msgs[0]).toContain("물러났다");
    expect(msgs[0]).not.toContain("세상을 떠났다");
  });
});

describe("역사 표현", () => {
  it("645년에는 아직 나당동맹이 없고 660년에는 있다", () => {
    const of = (year: number) => SCENARIOS.find((x) => x.year === year)!.alliances.flat();
    expect(of(645)).not.toContain("tang");
    expect(of(660)).toContain("tang");
  });
});

describe("사건으로 죽은 인물", () => {
  it("전사 기록이 있는 인물은 수명이 그해로 끝나지 않는다", () => {
    expect(lifespanEnd({ id: "gyebaek", born: 610, died: 660 })).toBe(670);
    expect(lifespanEnd({ id: "someone", born: 610, died: 660 })).toBe(660);
  });

  it("계백은 660년 하반기에 자연사하지 않는다", () => {
    const restore = seedRandom(5);
    try {
      const s = createGame(1, [], "history", 2, false);
      const g = Object.values(s.officers).find((o) => o.id === "gyebaek")!;
      expect(officersIn(s, g.region)).toContain(g);
      s.year = 660;
      s.month = 7;
      for (let i = 0; i < 40; i++) monthStart(s);
      expect(g.alive).toBe(true);
    } finally {
      restore();
    }
  });
});
