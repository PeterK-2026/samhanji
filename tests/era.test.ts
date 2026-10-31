// 게임의 끝: 시대의 끝 판정, 모든 나라의 소멸, 재야 추대
import { describe, expect, it } from "vitest";
import { regionDef } from "../src/data/regions";
import { Game } from "../src/engine/game";
import type { IO } from "../src/engine/io";
import { ERA_END, destroyFaction, judge, killOfficer } from "../src/engine/politics";
import { createGame, regionOf } from "../src/engine/state";
import { FACTION_IDS, type FactionId, type GameState } from "../src/engine/types";

function silent() {
  const said: string[] = [];
  const io = {
    say: (t: string) => void said.push(t),
    clear() {}, table() {}, refresh() {}, showOfficer() {}, showBattle() {},
    pause: async () => {}, sleep: async () => {},
    choose: async () => 0, number: async () => 0, confirm: async () => true,
    pickRegion: async () => null, pickHex: async () => null,
  } as IO;
  return { io, said };
}

const members = (s: GameState, f: FactionId) => Object.values(s.officers).filter((o) => o.alive && o.faction === f);

describe("시대의 끝", () => {
  it("플레이어가 가장 앞서면 판정승으로 끝난다", async () => {
    const s = createGame(1, ["silla"], "history", 2, false);
    const han = s.regions.filter((r) => regionDef(r.id).korea);
    for (const r of han) r.owner = "silla";
    han[0].owner = "baekje"; // 통일은 아니다
    s.year = ERA_END;
    const { io, said } = silent();
    await new Game(io, s).run();
    expect(s.over).toBe(true);
    expect(s.judged).toBe("silla");
    expect(said.join()).toContain("판정승");
  });

  it("앞선 세력은 삼한 땅으로 가린다", () => {
    const s = createGame(1, [], "history", 2, false);
    const han = s.regions.filter((r) => regionDef(r.id).korea);
    for (const r of s.regions) r.owner = "tang";
    for (const [i, r] of han.entries()) r.owner = i < han.length / 2 + 1 ? "baekje" : "tang";
    expect(s.regions.filter((r) => r.owner === "tang").length).toBeGreaterThan(s.regions.filter((r) => r.owner === "baekje").length);
    expect(judge(s)).toBe("baekje"); // 전체 땅은 당이 많아도 삼한 땅이 기준이다
  });
});

describe("모든 나라의 소멸", () => {
  it("남은 나라가 없으면 게임이 끝난다", async () => {
    const s = createGame(1, [], "history", 2, false);
    for (const f of FACTION_IDS) destroyFaction(s, f, "heirless");
    const { io, said } = silent();
    await new Game(io, s).run();
    expect(s.over).toBe(true);
    expect(s.judged).toBeUndefined();
    expect(said.join()).toContain("모두 사라졌습니다");
  });
});

describe("재야 추대", () => {
  const lastRuler = (f: FactionId) => {
    const s = createGame(1, [], "history", 2, false);
    const ruler = s.officers[s.factions[f].ruler!];
    for (const o of members(s, f)) if (o !== ruler) o.alive = false;
    return { s, ruler };
  };

  it("신하가 없으면 영토 안의 재야 인물이 뒤를 잇는다", () => {
    const { s, ruler } = lastRuler("silla");
    const free = Object.values(s.officers).find((o) => o.alive && o.faction === null)!;
    free.region = ruler.region;
    expect(regionOf(s, free.region).owner).toBe("silla");
    const msgs = killOfficer(s, ruler);
    expect(s.factions.silla.alive).toBe(true);
    const heir = s.officers[s.factions.silla.ruler!];
    expect(heir.id).not.toBe(ruler.id);
    expect(heir.faction).toBe("silla");
    expect(heir.hidden).toBe(false);
    expect(msgs.join()).toContain("추대");
  });

  it("재야 인물도 없으면 나라가 망하고 원인이 남는다", () => {
    const { s, ruler } = lastRuler("silla");
    for (const o of Object.values(s.officers)) if (o.faction === null) o.alive = false;
    killOfficer(s, ruler);
    expect(s.factions.silla.alive).toBe(false);
    expect(s.factions.silla.fallCause).toBe("heirless");
  });
});
