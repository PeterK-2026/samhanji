import { regionDef } from "../data/regions";
import { HEIRS } from "../data/scenarios";
import { factionOfficers, regionOf, regionsOf } from "./state";
import type { FactionId, GameState, Officer } from "./types";

// 장수 사망 처리. 군주였다면 후계를 정하고 그 결과 메시지를 돌려준다.
export function killOfficer(s: GameState, o: Officer): string[] {
  o.alive = false;
  o.men = 0;
  const msgs: string[] = [];
  const f = o.faction;
  if (f && s.factions[f].ruler === o.id) msgs.push(...succeed(s, f, o));
  return msgs;
}

export function succeed(s: GameState, f: FactionId, old: Officer): string[] {
  const fac = s.factions[f];
  const members = factionOfficers(s, f).filter((x) => x.id !== old.id);
  let heir = HEIRS[f].map((id) => s.officers[id]).find((x) => x && x.alive && x.faction === f);
  if (!heir) heir = members.sort((a, b) => b.chr + b.int - (a.chr + a.int))[0];
  if (!heir) {
    fac.ruler = null;
    return destroyFaction(s, f);
  }
  fac.ruler = heir.id;
  heir.loy = 100;
  const msgs = [`${fac.name}의 ${old.name}이(가) 세상을 떠났다. ${heir.name}이(가) 뒤를 이었다.`];
  const gaesomun = s.officers["gaesomun"];
  if (f === "goguryeo" && old.id === "yeongnyu" && heir.id === "bojang" && gaesomun?.alive && gaesomun.faction === f) {
    msgs[0] = "연개소문이 정변을 일으켜 영류왕을 시해하고 보장왕을 옹립했다! 연개소문은 대막리지가 되어 실권을 쥐었다.";
  }
  // 군주 교체 시 충성이 낮은 장수는 동요한다
  for (const m of members) if (m.id !== heir.id) m.loy = Math.max(0, m.loy - 5);
  return msgs;
}

export function destroyFaction(s: GameState, f: FactionId): string[] {
  const fac = s.factions[f];
  if (!fac.alive) return [];
  fac.alive = false;
  fac.ruler = null;
  for (const r of regionsOf(s, f)) r.owner = null;
  for (const o of factionOfficers(s, f)) {
    o.faction = null;
    o.men = 0;
    o.hidden = false;
  }
  s.alliances = s.alliances.filter((k) => !k.split("|").includes(f));
  return [`${fac.name}이(가) 멸망했다!`];
}

// 지역을 모두 잃은 세력 정리
export function checkFactions(s: GameState): string[] {
  const msgs: string[] = [];
  for (const f of Object.values(s.factions)) {
    if (f.alive && regionsOf(s, f.id).length === 0) msgs.push(...destroyFaction(s, f.id));
  }
  return msgs;
}

export function victor(s: GameState): FactionId | null {
  const korea = s.regions.filter((r) => regionDef(r.id).korea);
  const owner = korea[0].owner;
  if (owner && korea.every((r) => r.owner === owner)) return owner;
  return null;
}

export function playerAlive(s: GameState): boolean {
  return Object.values(s.factions).some((f) => f.player && f.alive);
}

export function regionLabel(s: GameState, id: number): string {
  return `${id}. ${regionOf(s, id).name}`;
}
