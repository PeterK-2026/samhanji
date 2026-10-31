// 전술 전투 회귀 테스트: 행동 중복, 군주 이간, 달을 넘기는 지휘 설정
import { describe, expect, it } from "vitest";
import { seedRandom } from "../src/dev/seed";
import { Battle } from "../src/engine/battle";
import { neighbors } from "../src/engine/hex";
import type { IO, Option } from "../src/engine/io";
import { createGame, officersIn } from "../src/engine/state";
import type { Officer } from "../src/engine/types";

const quietIO = (choice = 1): IO => ({
  say() {}, clear() {}, table() {}, refresh() {}, showOfficer() {}, showBattle() {},
  pause: async () => {}, sleep: async () => {},
  choose: async (_p: string, o: Option[]) => (o.some((x) => x.value === choice) ? choice : o[0].value),
  number: async (_p, min) => min,
  confirm: async () => true,
  pickRegion: async () => null,
  pickHex: async (_p, a) => a[0] ?? null,
});

// 신라군 둘이 백제 부대 하나에 붙어 있는 전장
function field(io: IO) {
  const s = createGame(1, ["silla"], "history", 2, false);
  const mine = s.regions.find((r) => r.owner === "silla" && officersIn(s, r.id).length >= 2)!;
  const foeRegion = s.regions.find((r) => r.owner === "baekje" && officersIn(s, r.id).length >= 2)!;
  const b = new Battle(s, io, mine, foeRegion, "silla", "baekje");
  const unit = (o: Officer, side: "atk" | "def", hex: number) => ({ o, side, faction: o.faction, hex, done: false, moved: false, gone: false, home: o.region });
  const [a1, a2] = officersIn(s, mine.id);
  const [d1, d2] = officersIn(s, foeRegion.id);
  for (const o of [a1, a2, d1, d2]) { o.men = 3000; o.inBattle = foeRegion.id; }
  const center = neighbors(100).length === 6 ? 100 : 101;
  const [h1, h2] = neighbors(center);
  const [u1, u2] = [unit(a1, "atk", h1), unit(a2, "atk", h2)];
  const [t1, t2] = [unit(d1, "def", center), unit(d2, "def", neighbors(center)[4])];
  b.atk.units.push(u1, u2);
  b.def.units.push(t1, t2);
  b.atk.commander = u1;
  b.def.commander = t1;
  return { s, b, u1, u2, t1, t2 };
}

describe("동시 공격", () => {
  it("함께 친 부대는 같은 날 다시 명령을 받지 않는다", async () => {
    const restore = seedRandom(3);
    try {
      const { b, u1, t1 } = field(quietIO());
      const called: string[] = [];
      b.commandUnit = async (u) => {
        called.push(u.o.name);
        await b.simultaneous(u, t1);
      };
      await b.playerPhase(b.atk);
      expect(called).toEqual([u1.o.name]);
    } finally {
      restore();
    }
  });

  it("이미 행동한 부대는 동시 공격에 끼지 못한다", () => {
    const { b, u1, u2, t1 } = field(quietIO());
    expect(b.allies(t1, b.atk)).toEqual([u1, u2]);
    u2.done = true;
    expect(b.allies(t1, b.atk)).toEqual([u1]);
  });
});

describe("이간", () => {
  it("군주·총대장은 이간할 수 없고 일반 장수는 할 수 있다", async () => {
    const { s, b, u1, t1, t2 } = field(quietIO());
    expect(b.canPlot(t1)).toBe(false);
    expect(b.canPlot(t2)).toBe(true);
    s.factions.baekje.ruler = t2.o.id;
    expect(b.canPlot(t2)).toBe(false);
    const gold = (b.atk.gold = 500);
    await b.plot(u1, t2);
    expect(b.atk.gold).toBe(gold); // 실행 함수도 막는다
    expect(t2.side).toBe("def");
  });
});

describe("끝까지 맡김", () => {
  it("저장했다 복원해도 유지되고, 맡기지 않은 쪽은 그대로다", () => {
    const { s, b } = field(quietIO());
    b.atk.player = false;
    const io = quietIO();
    expect(Battle.restore(s, io, b.save(1)).atk.player).toBe(false);
    b.atk.player = true;
    expect(Battle.restore(s, io, b.save(1)).atk.player).toBe(true);
  });

  it("예전 저장에는 값이 없어도 세력으로 정해진다", () => {
    const { s, b } = field(quietIO());
    const ob = b.save(1);
    delete ob.atk.player;
    expect(Battle.restore(s, quietIO(), ob).atk.player).toBe(true);
  });
});
