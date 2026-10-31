// 장수별 행동 규칙: 명령마다 장수를 고르고, 고른 장수는 그달에 다시 쓸 수 없다
import { describe, expect, it } from "vitest";
import { seedRandom } from "../src/dev/seed";
import { aiAct } from "../src/engine/ai";
import { runCommand, type Ctx } from "../src/engine/commands";
import type { IO, Option } from "../src/engine/io";
import { createGame, officersIn, readyOfficersIn, regionOf, rulerHere } from "../src/engine/state";
import type { FactionId, GameState } from "../src/engine/types";

// choose·number를 차례로 답하는 IO. 장수 목록이 나오면 그 목록을 기록한다
function scripted(answers: (number | null)[], region: number | null = null) {
  const listed: string[][] = [];
  const said: string[] = [];
  const next = async () => (answers.length ? answers.shift()! : null);
  const io = {
    say: (t: string) => void said.push(t),
    clear() {},
    pause: async () => {},
    table() {},
    refresh() {},
    showOfficer() {},
    showBattle() {},
    sleep: async () => {},
    choose: async (_p: string, o: Option[]) => {
      if (o.some((x) => x.officer)) listed.push(o.filter((x) => x.officer).map((x) => x.officer!));
      return next();
    },
    number: next,
    confirm: async () => true,
    pickRegion: async () => region,
    pickHex: async () => null,
  } as IO;
  return { io, listed, said };
}

function setup(need: number, ruler: boolean) {
  const s = createGame(1, ["silla"], "history", 2, false);
  const f: FactionId = "silla";
  const r = s.regions.find((x) => x.owner === f && officersIn(s, x.id).length >= need && rulerHere(s, x.id, f) === ruler);
  if (!r) throw new Error("맞는 지역이 없음");
  r.gold = 1000;
  r.land = 10;
  return { s, f, rid: r.id };
}

const ctx = (s: GameState, io: IO, rid: number, f: FactionId): Ctx => ({ s, io, rid, f });

describe("명령을 맡을 장수", () => {
  it("고른 장수만 행동을 마치고 그 지력이 결과에 쓰인다", async () => {
    const { s, f, rid } = setup(2, false);
    const offs = officersIn(s, rid);
    const { io } = scripted([2, 100]);
    expect(await runCommand(ctx(s, io, rid, f), 9, async () => "continue")).toBe(true);
    expect(offs.filter((o) => o.acted)).toEqual([offs[1]]);
  });

  it("취소하면 장수가 행동을 쓰지 않는다", async () => {
    const { s, f, rid } = setup(2, false);
    const { io } = scripted([1, null]);
    expect(await runCommand(ctx(s, io, rid, f), 9, async () => "continue")).toBe(false);
    expect(readyOfficersIn(s, rid)).toHaveLength(officersIn(s, rid).length);
  });

  it("행동한 장수는 다음 명령의 목록에 나오지 않는다", async () => {
    const { s, f, rid } = setup(2, false);
    const offs = officersIn(s, rid);
    offs[0].acted = true;
    const { io, listed } = scripted([1, 100]);
    await runCommand(ctx(s, io, rid, f), 10, async () => "continue");
    expect(listed[0]).not.toContain(offs[0].id);
    expect(listed[0]).toHaveLength(offs.length - 1);
  });

  it("모두 행동한 지역에서는 장수가 필요한 명령을 쓸 수 없다", async () => {
    const { s, f, rid } = setup(1, false);
    for (const o of officersIn(s, rid)) o.acted = true;
    const { io, said } = scripted([]);
    expect(await runCommand(ctx(s, io, rid, f), 9, async () => "continue")).toBe(false);
    expect(said.join()).toContain("장수가 없습니다");
  });

  it("정보: 우리 정보는 장수를 고르지 않는다", async () => {
    const { s, f, rid } = setup(2, false);
    for (const sub of [1, 2, 3, 4]) {
      const { io, listed } = scripted([sub, 1], rid);
      expect(await runCommand(ctx(s, io, rid, f), 8, async () => "continue")).toBe(false);
      expect(listed.flat()).toHaveLength(sub === 2 ? officersIn(s, rid).length : 0); // 2는 볼 장수를 고르는 목록
    }
    expect(readyOfficersIn(s, rid)).toHaveLength(officersIn(s, rid).length);
  });

  it("정보: 남의 지역을 보려면 장수의 행동을 쓴다", async () => {
    const { s, f, rid } = setup(2, false);
    const foe = s.regions.find((x) => x.owner && x.owner !== f)!;
    const { io } = scripted([1, 1], foe.id);
    expect(await runCommand(ctx(s, io, rid, f), 8, async () => "continue")).toBe(true);
    expect(officersIn(s, rid).filter((o) => o.acted)).toHaveLength(1);
  });

  it("재배치는 넘기는 장수만 행동을 쓴다", async () => {
    const { s, f, rid } = setup(2, false);
    const offs = officersIn(s, rid);
    offs[0].men = 1000;
    offs[1].men = 0;
    const { io } = scripted([2, 1, 1, 100]);
    expect(await runCommand(ctx(s, io, rid, f), 4, async () => "continue")).toBe(true);
    expect(offs[0].acted).toBe(true);
    expect(offs[1].acted).toBeFalsy();
    expect(offs[1].men).toBe(100);
  });
});

describe("외교", () => {
  it("군주가 없는 지역에서는 할 수 없다", async () => {
    const { s, f, rid } = setup(1, false);
    const { io, said } = scripted([1]);
    expect(await runCommand(ctx(s, io, rid, f), 6, async () => "continue")).toBe(false);
    expect(said.join()).toContain("군주");
  });

  it("군주 지역에서는 고른 사신이 간다", async () => {
    const { s, f, rid } = setup(1, true);
    const before = Object.values(s.relations);
    const { io } = scripted([1, 1, 1, 300]);
    expect(await runCommand(ctx(s, io, rid, f), 6, async () => "continue")).toBe(true);
    expect(officersIn(s, rid).filter((o) => o.acted)).toHaveLength(1);
    expect(Object.values(s.relations)).not.toEqual(before);
  });
});

describe("AI", () => {
  it("여러 장수가 움직이고, 모두 행동한 지역은 더 움직이지 않는다", async () => {
    const restore = seedRandom(7);
    try {
      const { s, f, rid } = setup(2, false);
      s.factions[f].player = false;
      const { io } = scripted([]);
      const r = regionOf(s, rid);
      r.gold = 5000;
      await aiAct(s, io, rid);
      expect(Object.values(s.officers).filter((o) => o.acted).length).toBeGreaterThanOrEqual(2);
      for (const o of officersIn(s, rid)) o.acted = true;
      const before = JSON.stringify(s);
      await aiAct(s, io, rid);
      expect(JSON.stringify(s)).toBe(before);
    } finally {
      restore();
    }
  });
});
