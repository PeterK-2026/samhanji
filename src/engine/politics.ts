import { regionDef } from "../data/regions";
import { OFFICER_BY_ID } from "../data/officers";
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

export function succeed(s: GameState, f: FactionId, old: Officer, deposed = false): string[] {
  const fac = s.factions[f];
  const members = factionOfficers(s, f).filter((x) => x.id !== old.id);
  let heir = HEIRS[f].map((id) => s.officers[id]).find((x) => x && x.alive && x.faction === f);
  if (!heir) heir = members.sort((a, b) => b.chr + b.int - (a.chr + a.int))[0];
  // 신하가 아무도 없으면 영토 안의 재야 인물을 추대한다 [설계]
  const crowned = heir ? undefined : freeHeir(s, f);
  heir ??= crowned;
  if (!heir) {
    fac.ruler = null;
    return destroyFaction(s, f, "heirless");
  }
  heir.faction = f;
  heir.hidden = false;
  fac.ruler = heir.id;
  heir.loy = 100;
  const gone = `${fac.name}의 ${old.name}이(가) ${deposed ? "물러났다" : "세상을 떠났다"}.`;
  const msgs = [crowned ? `${gone} 뒤를 이을 사람이 없어 재야의 ${heir.name}이(가) 추대되었다.` : `${gone} ${heir.name}이(가) 뒤를 이었다.`];
  const gaesomun = s.officers["gaesomun"];
  if (!deposed && f === "goguryeo" && old.id === "yeongnyu" && heir.id === "bojang" && gaesomun?.alive && gaesomun.faction === f) {
    msgs[0] = "연개소문이 정변을 일으켜 영류왕을 시해하고 보장왕을 옹립했다! 연개소문은 대막리지가 되어 실권을 쥐었다.";
  }
  // 군주 교체 시 충성이 낮은 장수는 동요한다
  for (const m of members) if (m.id !== heir.id) m.loy = Math.max(0, m.loy - 5);
  return msgs;
}

// 영토 안의 재야 인물 중 군주감: 그 나라 출신을 먼저, 그다음 매력·지력 순
function freeHeir(s: GameState, f: FactionId): Officer | undefined {
  const score = (o: Officer) => (OFFICER_BY_ID.get(o.id)?.home === f ? 1000 : 0) + o.chr + o.int;
  return Object.values(s.officers)
    .filter((o) => o.alive && o.faction === null && regionOf(s, o.region).owner === f)
    .sort((a, b) => score(b) - score(a))[0];
}

export function destroyFaction(s: GameState, f: FactionId, cause: "conquest" | "heirless"): string[] {
  const fac = s.factions[f];
  if (!fac.alive) return [];
  fac.alive = false;
  fac.fallCause = cause;
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
    if (f.alive && regionsOf(s, f.id).length === 0) msgs.push(...destroyFaction(s, f.id, "conquest"));
  }
  return msgs;
}

// 시대의 끝: 실존 인물 명단이 680년대부터 급격히 줄어 700년이면 거의 남지 않는다.
// 이해 1월까지 통일되지 않으면 삼한 땅을 가장 많이 가진 세력이 앞선 것으로 게임을 마친다 [설계]
export const ERA_END = 700;

export function judge(s: GameState): FactionId | null {
  const korea = (f: FactionId) => s.regions.filter((r) => r.owner === f && regionDef(r.id).korea).length;
  const alive = Object.values(s.factions).filter((f) => f.alive).map((f) => f.id);
  return alive.sort((a, b) => korea(b) - korea(a) || regionsOf(s, b).length - regionsOf(s, a).length)[0] ?? null;
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
