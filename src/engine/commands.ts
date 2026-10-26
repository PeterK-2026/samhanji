import { OFFICER_BY_ID } from "../data/officers";
import { regionDef } from "../data/regions";
import { MAX_UNITS, war } from "./battle";
import { MAX_FOOD, MAX_GOLD, factionTotals } from "./economy";
import type { IO, Option } from "./io";
import { regionLabel } from "./politics";
import {
  adjacent, age, bestBy, breakAlliance, chance, changeRelation, clamp, connectedOwn,
  factionOfficers, freeOfficersIn, isAllied, menCap, menIn, officersIn, rand, regionOf, relation,
} from "./state";
import { FACTION_IDS, pairKey, type FactionId, type GameState, type Officer } from "./types";

export interface Ctx {
  s: GameState;
  io: IO;
  rid: number;
  f: FactionId;
}

export const COMMANDS: { no: number; name: string; free?: boolean }[] = [
  { no: 0, name: "휴식" }, { no: 1, name: "이동" }, { no: 2, name: "수송" }, { no: 3, name: "전쟁" },
  { no: 4, name: "군사" }, { no: 5, name: "인재" }, { no: 6, name: "외교" }, { no: 7, name: "첩보" },
  { no: 8, name: "정보", free: true }, { no: 9, name: "개간" }, { no: 10, name: "치수" }, { no: 11, name: "포상" },
  { no: 12, name: "시혜" }, { no: 13, name: "상인" }, { no: 14, name: "세율", free: true }, { no: 15, name: "세력", free: true },
  { no: 16, name: "위임", free: true }, { no: 17, name: "추방", free: true }, { no: 18, name: "조언", free: true }, { no: 19, name: "기타", free: true },
];

// ── 공용 선택 도우미 ──
export function officerLine(s: GameState, o: Officer): string {
  return `${o.name}  지${o.int} 무${o.war} 매${o.chr} 충${o.loy} 병${o.men} 훈${o.trn} 나이${age(s, o)}`;
}

export function showOfficerCard(c: Ctx, o: Officer) {
  c.io.showOfficer(o.id, o.name, [
    `지력 ${o.int} · 무력 ${o.war} · 매력 ${o.chr} · 충성 ${o.loy}`,
    `병사 ${o.men.toLocaleString("ko-KR")} · 훈련 ${o.trn} · 무장 ${o.arm} · 나이 ${age(c.s, o)}`,
    OFFICER_BY_ID.get(o.id)?.note ?? "",
  ]);
}

async function pickOfficer(c: Ctx, prompt: string, list: Officer[]): Promise<Officer | null> {
  if (list.length === 0) {
    c.io.say("해당하는 장수가 없습니다.");
    return null;
  }
  const v = await c.io.choose(prompt, list.map((o, i) => ({ value: i + 1, label: officerLine(c.s, o), officer: o.id })), { cancel: true, columns: 1 });
  return v ? list[v - 1] : null;
}

async function pickOfficers(c: Ctx, prompt: string, list: Officer[]): Promise<Officer[]> {
  const chosen: Officer[] = [];
  let rest = [...list];
  while (rest.length) {
    const opts: Option[] = rest.map((o, i) => ({ value: i + 1, label: officerLine(c.s, o), officer: o.id }));
    opts.unshift({ value: 0, label: chosen.length ? `선택 완료 (${chosen.map((o) => o.name).join(", ")})` : "취소" });
    const v = await c.io.choose(prompt, opts, { columns: 1 });
    if (!v) break;
    chosen.push(rest[v - 1]);
    rest = rest.filter((_, i) => i !== v - 1);
  }
  return chosen;
}

function owned(c: Ctx) {
  return regionOf(c.s, c.rid);
}

// ── 1 이동 ──
async function cmdMove(c: Ctx): Promise<boolean> {
  const dests = adjacent(c.rid).filter((n) => regionOf(c.s, n).owner === c.f);
  if (!dests.length) return c.io.say("인접한 아군 지역이 없습니다."), false;
  const to = await c.io.pickRegion("어느 지역으로 이동합니까?", dests);
  if (!to) return false;
  const movers = await pickOfficers(c, "이동할 장수를 고르십시오", officersIn(c.s, c.rid));
  if (!movers.length) return false;
  const r = owned(c);
  const dest = regionOf(c.s, to);
  // 받는 지역의 창고 한도를 넘지 않게 한다
  const gMax = Math.min(r.gold, MAX_GOLD - dest.gold);
  const fMax = Math.min(r.food, MAX_FOOD - dest.food);
  const gold = (await c.io.number(`가져갈 금 (0~${gMax})`, 0, gMax, 0)) ?? 0;
  const food = (await c.io.number(`가져갈 군량 (0~${fMax})`, 0, fMax, 0)) ?? 0;
  r.gold -= gold; r.food -= food; dest.gold += gold; dest.food += food;
  for (const o of movers) o.region = to;
  c.io.say(`${movers.map((o) => o.name).join(", ")}이(가) ${dest.name}(으)로 이동했습니다.`);
  return true;
}

// ── 2 수송 ──
async function cmdSend(c: Ctx): Promise<boolean> {
  const dests = connectedOwn(c.s, c.rid);
  if (!dests.length) return c.io.say("보낼 수 있는 아군 지역이 없습니다."), false;
  const to = await c.io.pickRegion("어느 지역으로 보냅니까?", dests);
  if (!to) return false;
  const r = owned(c);
  const dest = regionOf(c.s, to);
  const gMax = Math.min(r.gold, MAX_GOLD - dest.gold);
  const fMax = Math.min(r.food, MAX_FOOD - dest.food);
  const gold = (await c.io.number(`보낼 금 (0~${gMax})`, 0, gMax, 0)) ?? 0;
  const food = (await c.io.number(`보낼 군량 (0~${fMax})`, 0, fMax, 0)) ?? 0;
  if (!gold && !food) return false;
  r.gold -= gold; r.food -= food; dest.gold += gold; dest.food += food;
  c.io.say(`${dest.name}(으)로 금 ${gold}, 군량 ${food}을(를) 보냈습니다.`);
  return true;
}

// ── 3 전쟁 ──
async function cmdWar(c: Ctx): Promise<boolean> {
  const targets = adjacent(c.rid).filter((n) => regionOf(c.s, n).owner !== c.f);
  if (!targets.length) return c.io.say("공격할 수 있는 지역이 없습니다."), false;
  const t = await c.io.pickRegion("어느 지역을 공격합니까?", targets);
  if (!t) return false;
  const tr = regionOf(c.s, t);
  if (tr.owner && isAllied(c.s, c.f, tr.owner)) {
    if (!(await c.io.confirm(`${c.s.factions[tr.owner].name}은(는) 동맹국입니다. 동맹을 깨고 공격합니까?`))) return false;
  }
  const army = await pickOfficers(c, `출진할 장수 (처음 고른 장수가 총대장, 최대 ${MAX_UNITS}명)`, officersIn(c.s, c.rid).filter((o) => o.men > 0));
  if (!army.length) return false;
  if (army.length > MAX_UNITS) army.length = MAX_UNITS;
  const r = owned(c);
  const men = army.reduce((a, o) => a + o.men, 0);
  // 원작: "Bring how much food? (Need N for 1 month)" — 병사 1명당 한 달 1석
  const need = men;
  const food = await c.io.number(`가져갈 군량 (0~${r.food}) — 한 달 분 ${need}석 필요`, 0, r.food, Math.min(r.food, need));
  if (food === null) return false;
  const gold = (await c.io.number(`가져갈 금 (0~${r.gold}) — 전장에서 계략(이간)에 씀`, 0, r.gold, Math.min(r.gold, 200))) ?? 0;
  c.io.table(
    army.map((o, i) => [i === 0 ? "총대장" : "", o.name, o.men, o.war, o.int]),
    ["", "장수", "병사", "무력", "지력"],
  );
  const foeMen = officersIn(c.s, t).reduce((a, o) => a + o.men, 0);
  c.io.say(`목표 ${tr.name} · 군주 ${tr.owner && c.s.factions[tr.owner].ruler ? c.s.officers[c.s.factions[tr.owner].ruler!].name : "-"} · 적 병력 약 ${Math.round(foeMen / 1000) * 1000} · 군량 ${food} · 금 ${gold}`);
  if (!(await c.io.confirm("출진합니까?"))) return false;
  await war(c.s, c.io, c.f, c.rid, t, { officers: army, food, gold });
  return true;
}

// ── 4 군사 ──
async function cmdMilitary(c: Ctx): Promise<boolean> {
  const r = owned(c);
  const sub = await c.io.choose("군사", [{ value: 1, label: "징병" }, { value: 2, label: "재배치" }, { value: 3, label: "훈련" }], { cancel: true });
  const offs = officersIn(c.s, c.rid);
  if (sub === 1) {
    const o = await pickOfficer(c, "누가 병사를 모읍니까?", offs);
    if (!o) return false;
    const room = menCap(o) - o.men;
    const max = Math.min(room, r.gold * 2, Math.floor(r.pop * 0.1));
    if (max <= 0) return c.io.say("더 모을 수 없습니다. (금·인구·통솔 한도)"), false;
    const n = await c.io.number(`몇 명을 모읍니까? (병사 2명당 금 1, 최대 ${max})`, 0, max, max);
    if (!n) return false;
    o.trn = Math.round((o.trn * o.men + 10 * n) / (o.men + n));
    o.men += n;
    r.gold -= Math.ceil(n / 2);
    r.pop -= n;
    r.loyalty = clamp(r.loyalty - Math.ceil(n / 2000), 0, 100);
    c.io.say(`${o.name}의 부대가 ${o.men}명이 되었습니다.`);
    return true;
  }
  if (sub === 2) {
    const a = await pickOfficer(c, "누구의 병사를 넘깁니까?", offs.filter((o) => o.men > 0));
    if (!a) return false;
    const b = await pickOfficer(c, "누구에게 넘깁니까?", offs.filter((o) => o !== a));
    if (!b) return false;
    const max = Math.min(a.men, menCap(b) - b.men);
    const n = await c.io.number(`몇 명을 넘깁니까? (최대 ${max})`, 0, max, max);
    if (!n) return false;
    b.trn = Math.round((b.trn * b.men + a.trn * n) / (b.men + n));
    a.men -= n; b.men += n;
    c.io.say(`${a.name} → ${b.name} 병사 ${n}명 재배치.`);
    return true;
  }
  if (sub === 3) {
    const o = await pickOfficer(c, "누구의 부대를 훈련합니까?", offs.filter((x) => x.men > 0));
    if (!o) return false;
    const gain = 5 + Math.floor((o.war + o.int) / 25);
    o.trn = Math.min(100, o.trn + gain);
    c.io.say(`${o.name} 부대의 훈련도가 ${o.trn}이(가) 되었습니다.`);
    return true;
  }
  return false;
}

// ── 5 인재 ──
async function cmdPerson(c: Ctx): Promise<boolean> {
  const sub = await c.io.choose("인재", [{ value: 1, label: "탐색 (재야 인재 찾기)" }, { value: 2, label: "등용 (재야)" }, { value: 3, label: "빼내기 (적 장수)" }], { cancel: true, columns: 1 });
  const me = bestBy(officersIn(c.s, c.rid), "chr");
  if (!me) return false;
  if (sub === 1) {
    const hidden = freeOfficersIn(c.s, c.rid).filter((o) => o.hidden);
    if (hidden.length && chance(0.3 + me.chr / 150)) {
      const found = hidden[0];
      found.hidden = false;
      c.io.say(`${me.name}이(가) 재야의 인재 ${found.name}을(를) 찾아냈습니다!`);
      showOfficerCard(c, found);
    } else c.io.say(`${me.name}이(가) 두루 찾아보았으나 인재를 찾지 못했습니다.`);
    return true;
  }
  if (sub === 2) {
    const known = freeOfficersIn(c.s, c.rid).filter((o) => !o.hidden);
    const t = await pickOfficer(c, "누구를 등용합니까?", known);
    if (!t) return false;
    const p = clamp(0.35 + (me.chr - 50) / 100 + (OFFICER_BY_ID.get(t.id)?.home === c.f ? 0.2 : 0), 0.1, 0.95);
    if (chance(p)) {
      t.faction = c.f; t.loy = rand(65, 85); t.hidden = false;
      c.io.say(`${t.name}: "기꺼이 따르겠습니다." ${t.name}이(가) 가신이 되었습니다.`);
    } else c.io.say(`${t.name}이(가) 출사를 거절했습니다.`);
    return true;
  }
  if (sub === 3) {
    const near = [c.rid, ...adjacent(c.rid)];
    const enemies = Object.values(c.s.officers).filter((o) =>
      o.alive && o.faction && o.faction !== c.f && near.includes(o.region) && c.s.factions[o.faction].ruler !== o.id);
    const t = await pickOfficer(c, "누구를 빼내려 합니까? (금 100)", enemies);
    if (!t) return false;
    const r = owned(c);
    if (r.gold < 100) return c.io.say("금이 부족합니다."), false;
    r.gold -= 100;
    const p = clamp(((100 - t.loy) / 100) * (me.chr / 70), 0.02, 0.8);
    if (chance(p)) {
      t.faction = c.f; t.region = c.rid; t.men = 0; t.loy = rand(55, 75);
      c.io.say(`${t.name}이(가) 우리 편으로 넘어왔습니다!`);
    } else c.io.say(`${t.name}은(는) 넘어오지 않았습니다.`);
    return true;
  }
  return false;
}

// ── 6 외교 ──
async function cmdDiplomacy(c: Ctx): Promise<boolean> {
  const others = FACTION_IDS.filter((x) => x !== c.f && c.s.factions[x].alive);
  const tv = await c.io.choose("어느 나라와 교섭합니까?", others.map((x, i) => ({
    value: i + 1,
    label: `${c.s.factions[x].name} (우호 ${relation(c.s, c.f, x)}${isAllied(c.s, c.f, x) ? ", 동맹" : ""})`,
  })), { cancel: true, columns: 1 });
  if (!tv) return false;
  const t = others[tv - 1];
  const r = owned(c);
  const envoy = bestBy(officersIn(c.s, c.rid), "chr")!;
  const sub = await c.io.choose("무엇을 합니까?", [
    { value: 1, label: "예물 (우호 상승)" }, { value: 2, label: "동맹 제안 (금 200)" }, { value: 3, label: "동맹 파기" },
  ], { cancel: true, columns: 1 });
  if (sub === 1) {
    const g = await c.io.number(`예물로 보낼 금 (0~${r.gold})`, 0, r.gold, Math.min(300, r.gold));
    if (!g) return false;
    r.gold -= g;
    const d = Math.round((g / 40) * (0.5 + envoy.chr / 100));
    changeRelation(c.s, c.f, t, d);
    c.io.say(`${envoy.name}이(가) 예물을 전했습니다. ${c.s.factions[t].name}과의 우호가 ${relation(c.s, c.f, t)}이(가) 되었습니다.`);
    return true;
  }
  if (sub === 2) {
    if (isAllied(c.s, c.f, t)) return c.io.say("이미 동맹입니다."), false;
    if (r.gold < 200) return c.io.say("금이 부족합니다."), false;
    r.gold -= 200;
    const p = clamp((relation(c.s, c.f, t) - 40) / 50 + (envoy.chr - 60) / 100, 0.02, 0.9);
    if (chance(p)) {
      c.s.alliances.push(pairKey(c.f, t));
      changeRelation(c.s, c.f, t, 10);
      c.io.say(`${envoy.name}의 설득으로 ${c.s.factions[t].name}과(와) 동맹을 맺었습니다!`);
    } else {
      changeRelation(c.s, c.f, t, -3);
      c.io.say(`${c.s.factions[t].name}이(가) 동맹을 거절했습니다.`);
    }
    return true;
  }
  if (sub === 3) {
    if (!isAllied(c.s, c.f, t)) return c.io.say("동맹 관계가 아닙니다."), false;
    breakAlliance(c.s, c.f, t);
    changeRelation(c.s, c.f, t, -30);
    c.io.say(`${c.s.factions[t].name}과(와)의 동맹을 파기했습니다.`);
    return true;
  }
  return false;
}

// ── 7 첩보 ──
async function cmdSpy(c: Ctx): Promise<boolean> {
  const sub = await c.io.choose("첩보", [{ value: 1, label: "정탐 (금 50)" }, { value: 2, label: "이간 (금 100)" }, { value: 3, label: "유언비어 (금 100)" }], { cancel: true, columns: 1 });
  if (!sub) return false;
  const r = owned(c);
  const cost = sub === 1 ? 50 : 100;
  if (r.gold < cost) return c.io.say("금이 부족합니다."), false;
  const spy = bestBy(officersIn(c.s, c.rid), "int")!;
  const enemyRegions = c.s.regions.filter((x) => x.owner && x.owner !== c.f).map((x) => x.id);
  const t = await c.io.pickRegion("대상 지역을 고르십시오", sub === 1 ? enemyRegions : enemyRegions.filter((id) => adjacent(c.rid).includes(id) || id === c.rid));
  if (!t) return false;
  r.gold -= cost;
  const tr = regionOf(c.s, t);
  if (sub === 1) {
    tr.spiedBy.push(c.f);
    showRegion(c, t, true);
    return true;
  }
  const foes = officersIn(c.s, t);
  const target = bestBy(foes, "int");
  const p = clamp(0.4 + (spy.int - (target?.int ?? 40)) / 100, 0.1, 0.85);
  if (sub === 2) {
    const victim = await pickOfficer(c, "누구를 이간합니까?", foes.filter((o) => tr.owner && c.s.factions[tr.owner].ruler !== o.id));
    if (!victim) return true;
    if (chance(p)) {
      victim.loy = Math.max(0, victim.loy - rand(10, 20));
      c.io.say(`${spy.name}의 이간책이 통했습니다. ${victim.name}의 충성이 ${victim.loy}(으)로 떨어졌습니다.`);
    } else c.io.say(`${spy.name}의 이간책이 실패했습니다.`);
    return true;
  }
  if (chance(p)) {
    tr.loyalty = clamp(tr.loyalty - rand(8, 15), 0, 100);
    c.io.say(`${tr.name}에 유언비어가 퍼져 민심이 ${tr.loyalty}(으)로 떨어졌습니다.`);
  } else c.io.say("유언비어가 퍼지지 않았습니다.");
  return true;
}

// ── 8 정보 ──
export function showRegion(c: Ctx, id: number, full: boolean) {
  const r = regionOf(c.s, id);
  const owner = r.owner ? c.s.factions[r.owner].name : "공백지";
  const d = regionDef(id);
  c.io.say(`【${regionLabel(c.s, id)} ${d.hanja}】 ${owner}  인구 ${r.pop}  성곽 ${r.forts}`);
  const offs = officersIn(c.s, id);
  if (full || r.owner === c.f || r.spiedBy.includes(c.f)) {
    c.io.say(`금 ${r.gold}  군량 ${r.food}  세율 ${r.rate}  민심 ${r.loyalty}  개발 ${r.land}  치수 ${r.flood}  군마 ${r.horses}`);
    c.io.table(offs.map((o) => [o.name, o.int, o.war, o.chr, o.loy, o.men, o.trn]), ["장수", "지력", "무력", "매력", "충성", "병사", "훈련"]);
  } else {
    c.io.say(`장수 ${offs.length}명  병사 약 ${Math.round(menIn(c.s, id) / 1000) * 1000}명 (자세한 사항은 첩보로)`);
  }
}

async function cmdView(c: Ctx): Promise<boolean> {
  const sub = await c.io.choose("무엇을 봅니까?", [
    { value: 1, label: "다른 지역" }, { value: 2, label: "장수" }, { value: 3, label: "우리 장수 일람" }, { value: 4, label: "재야 인재" },
  ], { cancel: true });
  if (sub === 1) {
    const t = await c.io.pickRegion("어느 지역을 봅니까?", c.s.regions.map((r) => r.id));
    if (t) showRegion(c, t, false);
  } else if (sub === 2) {
    const o = await pickOfficer(c, "누구를 봅니까?", officersIn(c.s, c.rid));
    if (o) showOfficerCard(c, o);
  } else if (sub === 3) {
    c.io.table(
      factionOfficers(c.s, c.f).map((o) => [o.name, regionOf(c.s, o.region).name, o.int, o.war, o.chr, o.loy, o.men]),
      ["장수", "위치", "지력", "무력", "매력", "충성", "병사"],
    );
  } else if (sub === 4) {
    const list = freeOfficersIn(c.s, c.rid).filter((o) => !o.hidden);
    if (!list.length) c.io.say("이 지역에서 알려진 재야 인재가 없습니다. (인재→탐색)");
    for (const o of list) c.io.say(officerLine(c.s, o));
  }
  return false;
}

// ── 9 개간 / 10 치수 ──
async function cmdDevelop(c: Ctx, key: "land" | "flood"): Promise<boolean> {
  const r = owned(c);
  const label = key === "land" ? "개간" : "치수";
  if (r[key] >= 100) return c.io.say(`더 이상 ${label}할 필요가 없습니다.`), false;
  const g = await c.io.number(`${label}에 쓸 금 (0~${r.gold})`, 0, r.gold, Math.min(200, r.gold));
  if (!g) return false;
  const off = bestBy(officersIn(c.s, c.rid), "int")!;
  const gain = Math.max(1, Math.floor((g / 25) * (0.5 + off.int / 200) * (1 - r[key] / 150)));
  r.gold -= g;
  r[key] = Math.min(100, r[key] + gain);
  c.io.say(`${off.name}의 지휘로 ${label}이(가) ${r[key]}(으)로 올랐습니다.`);
  return true;
}

// ── 11 포상 ──
async function cmdReward(c: Ctx): Promise<boolean> {
  const r = owned(c);
  const o = await pickOfficer(c, "누구에게 상을 내립니까?", officersIn(c.s, c.rid).filter((x) => c.s.factions[c.f].ruler !== x.id));
  if (!o) return false;
  const g = await c.io.number(`하사할 금 (0~${r.gold})`, 0, r.gold, Math.min(100, r.gold));
  if (!g) return false;
  r.gold -= g;
  o.loy = Math.min(100, o.loy + Math.ceil(g / 15));
  c.io.say(`${o.name}: "성은이 망극하옵니다." 충성 ${o.loy}`);
  return true;
}

// ── 12 시혜 ──
async function cmdGive(c: Ctx): Promise<boolean> {
  const r = owned(c);
  const n = await c.io.number(`백성에게 나눠줄 군량 (0~${r.food})`, 0, r.food, Math.min(2000, r.food));
  if (!n) return false;
  r.food -= n;
  r.loyalty = Math.min(100, r.loyalty + Math.ceil((n / r.pop) * 400));
  c.io.say(`백성들이 기뻐합니다. 민심 ${r.loyalty}`);
  return true;
}

// ── 13 상인 ──
async function cmdMerchant(c: Ctx): Promise<boolean> {
  const r = owned(c);
  const p = c.s.foodPrice;
  const sub = await c.io.choose(`상인이 찾아왔다. (군량 100석 = 금 ${p})`, [
    { value: 1, label: "군량 사기" }, { value: 2, label: "군량 팔기" }, { value: 3, label: "군마 사기 (10필 = 금 30)" }, { value: 4, label: "무기 사기" },
  ], { cancel: true, columns: 2 });
  if (sub === 1) {
    const max = Math.max(0, Math.min(Math.floor((r.gold / p) * 100), MAX_FOOD - r.food));
    const n = await c.io.number(`몇 석을 삽니까? (최대 ${max})`, 0, max, Math.min(max, 5000));
    if (!n) return false;
    r.gold -= Math.ceil((n * p) / 100); r.food += n;
  } else if (sub === 2) {
    const n = await c.io.number(`몇 석을 팝니까? (최대 ${r.food})`, 0, r.food, 0);
    if (!n) return false;
    r.food -= n; r.gold += Math.floor((n * p * 0.9) / 100);
  } else if (sub === 3) {
    const max = Math.floor(r.gold / 30) * 10;
    const n = await c.io.number(`몇 필을 삽니까? (최대 ${max})`, 0, max, Math.min(max, 100));
    if (!n) return false;
    r.gold -= Math.ceil(n / 10) * 30; r.horses += n;
  } else if (sub === 4) {
    const o = await pickOfficer(c, "누구의 부대에 무기를 줍니까?", officersIn(c.s, c.rid).filter((x) => x.men > 0));
    if (!o) return false;
    const g = await c.io.number(`무기에 쓸 금 (0~${r.gold})`, 0, r.gold, Math.min(200, r.gold));
    if (!g) return false;
    r.gold -= g;
    o.arm = Math.min(100, o.arm + Math.ceil((g / (o.men / 100 + 1)) * 2));
    c.io.say(`${o.name} 부대의 무장이 ${o.arm}이(가) 되었습니다.`);
  } else return false;
  c.io.say(`거래를 마쳤습니다. 금 ${r.gold}, 군량 ${r.food}, 군마 ${r.horses}`);
  return true;
}

// ── 14 세율 ──
async function cmdTax(c: Ctx): Promise<boolean> {
  const r = owned(c);
  const n = await c.io.number(`세율을 정하십시오 (현재 ${r.rate}, 0~100)`, 0, 100, r.rate);
  if (n === null) return false;
  r.rate = n;
  c.io.say(`세율을 ${n}(으)로 정했습니다.`);
  return false;
}

// ── 15 세력 ──
function cmdFactions(c: Ctx): boolean {
  const rows = FACTION_IDS.filter((x) => c.s.factions[x].alive).map((x) => {
    const t = factionTotals(c.s, x);
    const ruler = c.s.factions[x].ruler;
    return [
      c.s.factions[x].name, ruler ? c.s.officers[ruler].name : "-", t.regions, t.officers, t.men, t.gold, t.food,
      x === c.f ? "-" : `${relation(c.s, c.f, x)}${isAllied(c.s, c.f, x) ? " 동맹" : ""}`,
    ];
  });
  c.io.table(rows, ["세력", "군주", "지역", "장수", "병사", "금", "군량", "우호"]);
  return false;
}

// ── 16 위임 ──
async function cmdDelegate(c: Ctx): Promise<boolean> {
  const sub = await c.io.choose("위임", [{ value: 1, label: "이 지역을 위임" }, { value: 2, label: "모든 지역 위임" }, { value: 3, label: "위임 모두 해제" }], { cancel: true, columns: 1 });
  const mine = c.s.regions.filter((r) => r.owner === c.f);
  if (sub === 1) { owned(c).delegated = true; c.io.say("이 지역을 태수에게 맡겼습니다. (다음 달부터)"); }
  else if (sub === 2) { mine.forEach((r) => (r.delegated = true)); c.io.say("모든 지역을 위임했습니다. 매달 초에 위임을 계속할지 묻습니다."); }
  else if (sub === 3) { mine.forEach((r) => (r.delegated = false)); c.io.say("위임을 모두 해제했습니다."); }
  return false;
}

// ── 17 추방 ──
async function cmdExile(c: Ctx): Promise<boolean> {
  const o = await pickOfficer(c, "누구를 추방합니까?", officersIn(c.s, c.rid).filter((x) => c.s.factions[c.f].ruler !== x.id));
  if (!o) return false;
  if (!(await c.io.confirm(`${o.name}을(를) 정말 추방합니까? 병사 ${o.men}명은 흩어집니다.`))) return false;
  o.faction = null; o.men = 0; o.hidden = false;
  c.io.say(`${o.name}을(를) 추방했습니다.`);
  return false;
}

// ── 18 조언 ──
function cmdAdvice(c: Ctx): boolean {
  const advisor = bestBy(factionOfficers(c.s, c.f), "int");
  if (!advisor) return false;
  const r = owned(c);
  const men = menIn(c.s, c.rid);
  const tips: string[] = [];
  const monthsOfFood = men ? Math.floor(r.food / (men * 0.03)) : 99;
  if (monthsOfFood < 4) tips.push(`군량이 ${monthsOfFood}달 치밖에 없습니다. 상인에게서 사들이거나 수송해 오십시오.`);
  if (r.loyalty < 40) tips.push("민심이 흉흉합니다. 세율을 낮추거나 시혜를 베푸십시오.");
  const threats = adjacent(c.rid).map((n) => regionOf(c.s, n)).filter((x) => x.owner && x.owner !== c.f && !isAllied(c.s, c.f, x.owner));
  for (const t of threats) {
    const em = menIn(c.s, t.id);
    if (em > men * 1.3) tips.push(`${t.name}의 ${c.s.factions[t.owner!].name}군(${em}명)이 우리(${men}명)보다 강합니다. 방비를 굳히십시오.`);
    else if (men > em * 1.8 + 2000) tips.push(`${t.name}은(는) 방비가 약합니다(${em}명). 칠 만합니다.`);
  }
  if (freeOfficersIn(c.s, c.rid).some((o) => o.hidden)) tips.push("이 고을에 숨은 인재가 있다는 소문이 있습니다.");
  if (r.land < 50 && r.gold > 300) tips.push("땅을 개간하면 가을 수확이 늘어납니다.");
  if (!tips.length) tips.push("지금은 내정을 다지며 때를 기다리십시오.");
  c.io.say(`${advisor.name}: "${tips[rand(0, tips.length - 1)]}"`);
  return false;
}

export type OtherHandler = (c: Ctx) => Promise<"continue" | "quit">;

export async function runCommand(c: Ctx, no: number, other: OtherHandler): Promise<boolean | "quit"> {
  // 추방(무료 명령)으로 마지막 장수를 내보낸 뒤에는 장수가 필요한 명령을 쓸 수 없다
  if (!COMMANDS.find((x) => x.no === no)?.free && officersIn(c.s, c.rid).length === 0) {
    c.io.say("이 지역에는 명령을 수행할 장수가 없습니다.");
    return false;
  }
  switch (no) {
    case 1: return cmdMove(c);
    case 2: return cmdSend(c);
    case 3: return cmdWar(c);
    case 4: return cmdMilitary(c);
    case 5: return cmdPerson(c);
    case 6: return cmdDiplomacy(c);
    case 7: return cmdSpy(c);
    case 8: return cmdView(c);
    case 9: return cmdDevelop(c, "land");
    case 10: return cmdDevelop(c, "flood");
    case 11: return cmdReward(c);
    case 12: return cmdGive(c);
    case 13: return cmdMerchant(c);
    case 14: return cmdTax(c);
    case 15: return cmdFactions(c);
    case 16: return cmdDelegate(c);
    case 17: return cmdExile(c);
    case 18: return cmdAdvice(c);
    case 19: return (await other(c)) === "quit" ? "quit" : false;
  }
  return false;
}
