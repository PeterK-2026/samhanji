// 게임 상태 불변식 검사. 테스트·평가 스크립트·브라우저 디버그 패널이 함께 쓴다.
// 빈 배열이면 정상이고, 문제마다 한 줄씩 설명을 돌려준다.
import { REGION_DEFS } from "../data/regions";
import { MAX_FOOD, MAX_GOLD } from "../engine/economy";
import { FACTION_IDS, type GameState } from "../engine/types";

const inRange = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi;

export function checkInvariants(s: GameState): string[] {
  const out: string[] = [];
  const bad = (t: string) => out.push(t);

  if (s.regions.length !== REGION_DEFS.length) bad(`지역 수 ${s.regions.length} ≠ ${REGION_DEFS.length}`);
  if (!inRange(s.month, 1, 12)) bad(`월 값 이상: ${s.month}`);

  for (const [i, r] of s.regions.entries()) {
    const at = `지역 ${r.id}.${r.name}`;
    if (r.id !== i + 1) bad(`${at}: 배열 위치(${i})와 id 불일치`);
    if (r.owner && !s.factions[r.owner]?.alive) bad(`${at}: 멸망한 세력 ${r.owner}의 영토`);
    if (!inRange(r.gold, 0, MAX_GOLD)) bad(`${at}: 금 ${r.gold}`);
    if (!inRange(r.food, 0, MAX_FOOD)) bad(`${at}: 군량 ${r.food}`);
    if (!inRange(r.pop, 0, 1e7)) bad(`${at}: 인구 ${r.pop}`);
    for (const k of ["rate", "loyalty", "land", "flood", "forts"] as const) {
      if (!inRange(r[k], 0, 100)) bad(`${at}: ${k} ${r[k]}`);
    }
    if (!inRange(r.horses, 0, 1e6)) bad(`${at}: 군마 ${r.horses}`);
  }

  for (const o of Object.values(s.officers)) {
    const at = `장수 ${o.name}(${o.id})`;
    if (o.id === "__militia") bad(`${at}: 수비군이 상태에 남아 있음`);
    if (!inRange(o.region, 1, s.regions.length)) {
      bad(`${at}: 지역 번호 ${o.region}`);
      continue;
    }
    if (!o.alive) continue;
    if (!Number.isInteger(o.men) || o.men < 0) bad(`${at}: 병사 ${o.men}`);
    for (const k of ["int", "war", "chr", "loy", "trn", "arm"] as const) {
      if (!inRange(o[k], 0, 100)) bad(`${at}: ${k} ${o[k]}`);
    }
    if (o.faction) {
      if (!s.factions[o.faction].alive) bad(`${at}: 멸망한 세력 ${o.faction} 소속`);
      const owner = s.regions[o.region - 1].owner;
      if (owner !== o.faction) bad(`${at}: ${o.faction} 소속인데 ${owner ?? "공백지"} 땅(${o.region})에 있음`);
    }
  }

  for (const f of FACTION_IDS) {
    const fa = s.factions[f];
    const owned = s.regions.filter((r) => r.owner === f).length;
    if (!fa.alive) {
      if (owned) bad(`${fa.name}: 멸망했는데 ${owned}개 지역 보유`);
      continue;
    }
    if (!owned) bad(`${fa.name}: 살아 있는데 영토 없음`);
    const ruler = fa.ruler ? s.officers[fa.ruler] : undefined;
    if (!ruler) bad(`${fa.name}: 군주 없음`);
    else if (!ruler.alive || ruler.faction !== f) bad(`${fa.name}: 군주 ${ruler.name} 상태 이상 (생존 ${ruler.alive}, 소속 ${ruler.faction})`);
  }

  for (const [k, v] of Object.entries(s.relations)) if (!inRange(v, 0, 100)) bad(`관계 ${k}: ${v}`);
  if (new Set(s.spawned).size !== s.spawned.length) bad("spawned 목록에 중복 id");
  return out;
}
