import { regionDef } from "../data/regions";
import { checkFactions, killOfficer } from "./politics";
import {
  adjacent, chance, clamp, factionOfficers, isAllied, menIn, officersIn, rand, relation, spawnFreeOfficers,
} from "./state";
import { FACTION_IDS, pairKey, type FactionId, type GameState } from "./types";

export interface News {
  text: string;
  to?: FactionId; // 지정되면 그 세력에게만 보임
}

export const MAX_GOLD = 30000;
export const MAX_FOOD = 300000;

function incomeMult(s: GameState, owner: FactionId): number {
  if (s.factions[owner].player) return 1;
  return [0.85, 1, 1.25][s.difficulty - 1];
}

// 매달 초에 실행: 수입, 소비, 재해, 인물 생몰, 외교 변화
export function monthStart(s: GameState): News[] {
  const news: News[] = [];
  const m = s.month;

  // 곡물 시세: 수확 직후 싸고 봄에 비싸다
  const base = m >= 9 && m <= 11 ? 7 : m >= 3 && m <= 6 ? 13 : 10;
  s.foodPrice = base + rand(-2, 2);

  for (const r of s.regions) {
    r.spiedBy = [];
    if (!r.owner) continue;
    const owner = r.owner;
    const men = menIn(s, r.id);

    // 군량 소비
    r.food -= Math.ceil(men * 0.03);
    if (r.food < 0) {
      r.food = 0;
      for (const o of officersIn(s, r.id)) o.men = Math.floor(o.men * 0.85);
      r.loyalty = clamp(r.loyalty - 5, 0, 100);
      news.push({ text: `${r.name}: 군량이 바닥나 병사들이 달아나고 있다!`, to: owner });
    }

    // 세율에 따른 민심 변화
    r.loyalty = clamp(r.loyalty + Math.round((45 - r.rate) / 10), 0, 100);

    // 부흥운동 [설계]: 당이 다스리는 한반도 지역은 민심이 계속 떨어지고, 낮으면 부흥군이 일어난다
    // (백제·고구려 부흥운동). 이것이 없으면 중원의 물량을 가진 당이 거의 모든 판을 통일한다.
    if (owner === "tang" && regionDef(r.id).korea) {
      r.loyalty = clamp(r.loyalty - 2, 0, 100);
      if (r.loyalty < 30 && chance(0.06)) {
        for (const o of officersIn(s, r.id)) o.men = Math.floor(o.men * 0.85);
        r.food = Math.floor(r.food * 0.8);
        news.push({ text: `${r.name}에서 부흥군이 일어나 당군을 공격했다!`, to: owner });
      }
    }

    // 세금 (1월, 7월)
    if (m === 1 || m === 7) {
      const tax = Math.floor(r.pop * (r.rate / 100) * 0.025 * (0.5 + r.loyalty / 200) * incomeMult(s, owner));
      r.gold += tax;
    }

    // 인구 증감 (1월)
    if (m === 1) {
      const g = 1 + (r.loyalty - 40) / 1000 + r.land / 2500;
      r.pop = clamp(Math.floor(r.pop * g), 5000, 600000);
    }

    // 여름 홍수
    if (m >= 6 && m <= 8 && chance((100 - r.flood) / 500)) {
      r.land = clamp(r.land - rand(5, 12), 0, 100);
      r.pop = Math.floor(r.pop * 0.95);
      r.food = Math.floor(r.food * 0.8);
      news.push({ text: `${r.name}에 큰물이 져 논밭이 잠겼다.` });
    }

    // 역병
    if (chance(0.006)) {
      r.pop = Math.floor(r.pop * 0.9);
      for (const o of officersIn(s, r.id)) o.men = Math.floor(o.men * 0.9);
      news.push({ text: `${r.name}에 역병이 돌고 있다.` });
    }

    // 가을 수확 (9월)
    if (m === 9) {
      let mult = 0.6 + r.flood / 250;
      if (chance(0.05)) {
        mult *= 0.5;
        news.push({ text: `${r.name}에 메뚜기 떼가 덮쳐 수확이 반으로 줄었다.` });
      } else if (chance(0.08)) {
        mult *= 1.3;
        news.push({ text: `${r.name}에 풍년이 들었다!`, to: owner });
      }
      r.food += Math.floor(r.pop * (r.land / 100) * 0.2 * mult * incomeMult(s, owner));
    }

    // 창고 한도와 부패: 인구보다 많은 곡식은 조금씩 썩는다
    if (r.food > r.pop) r.food -= Math.floor((r.food - r.pop) * 0.03);
    r.food = Math.min(r.food, MAX_FOOD);
    r.gold = Math.min(r.gold, MAX_GOLD);

    // 민란
    if (r.loyalty < 20 && chance(0.12)) {
      for (const o of officersIn(s, r.id)) o.men = Math.floor(o.men * 0.8);
      r.gold = Math.floor(r.gold * 0.7);
      news.push({ text: `${r.name}에서 백성들이 들고일어났다!`, to: owner });
    }
  }

  // 인물의 죽음
  for (const o of Object.values(s.officers)) {
    if (!o.alive) continue;
    const limit = s.mode === "history" ? o.died : o.died + 5;
    // 사망 연도에는 하반기(7월~)부터 자연사할 수 있다. 시나리오 초반에 갑자기 죽지 않도록 한다.
    if (s.year >= limit && chance(s.year > limit ? 0.35 : s.month >= 7 ? 0.15 : 0)) {
      const ruler = o.faction && s.factions[o.faction].ruler === o.id;
      const extra = killOfficer(s, o);
      if (extra.length) news.push(...extra.map((t) => ({ text: t })));
      else if (o.faction) news.push({ text: `${o.name}이(가) 세상을 떠났다.`, to: ruler ? undefined : o.faction });
    }
  }

  // 충성이 낮은 장수의 출분
  for (const o of Object.values(s.officers)) {
    if (!o.alive || !o.faction || o.inBattle || s.factions[o.faction].ruler === o.id) continue;
    if (o.loy < 35 && chance(0.03)) {
      const f = o.faction;
      o.faction = null;
      o.men = 0;
      o.hidden = false;
      news.push({ text: `${o.name}이(가) 불만을 품고 떠나 재야로 들어갔다.`, to: f });
    }
  }

  // 1월: 새 인물 등장, AI 외교
  if (m === 1) {
    for (const o of spawnFreeOfficers(s)) {
      news.push({ text: `재야에 새 인물이 나타났다는 소문이 돈다. (${s.regions[o.region - 1].name} 부근)` });
    }
    aiDiplomacy(s, news);
  }

  news.push(...checkFactions(s).map((t) => ({ text: t })));
  return news;
}

// 동맹국이 아닌 적(또는 공백지)과 맞닿은 영토가 있는가
function openFront(s: GameState, f: FactionId): boolean {
  return s.regions.some((r) => r.owner === f && adjacent(r.id).some((n) => {
    const o = s.regions[n - 1].owner;
    return o !== f && !isAllied(s, f, o);
  }));
}

function aiDiplomacy(s: GameState, news: News[]) {
  for (let i = 0; i < FACTION_IDS.length; i++) {
    for (let j = i + 1; j < FACTION_IDS.length; j++) {
      const a = FACTION_IDS[i];
      const b = FACTION_IDS[j];
      if (!s.factions[a].alive || !s.factions[b].alive) continue;
      const key = pairKey(a, b);
      const rel = relation(s, a, b);
      const allied = s.alliances.includes(key);
      // 관계는 해마다 조금씩 30 쪽으로 돌아간다. 다만 한쪽이 더 칠 곳이 없는 동맹(공동의 적이 사라진 동맹)은 빠르게 식어
      // 2~3년이면 깨진다 (668년 고구려 멸망 → 670년 나당전쟁). 이것이 없으면 동맹끼리 끝까지 맞서 교착된다.
      const boxedIn = allied && (!openFront(s, a) || !openFront(s, b));
      s.relations[key] = boxedIn ? Math.max(0, rel - 25) : rel + (rel > 30 ? -1 : rel < 30 ? 1 : 0);
      if (s.factions[a].player || s.factions[b].player) continue;
      if (!allied && rel >= 60 && chance(0.3)) {
        s.alliances.push(key);
        news.push({ text: `${s.factions[a].name}과(와) ${s.factions[b].name}이(가) 동맹을 맺었다.` });
      } else if (allied && rel < 25) {
        s.alliances = s.alliances.filter((k) => k !== key);
        news.push({ text: `${s.factions[a].name}과(와) ${s.factions[b].name}의 동맹이 깨졌다.` });
      }
    }
  }
}

export function factionTotals(s: GameState, f: FactionId) {
  const regs = s.regions.filter((r) => r.owner === f);
  const offs = factionOfficers(s, f);
  return {
    regions: regs.length,
    officers: offs.length,
    men: offs.reduce((a, o) => a + o.men, 0),
    gold: regs.reduce((a, r) => a + r.gold, 0),
    food: regs.reduce((a, r) => a + r.food, 0),
    pop: regs.reduce((a, r) => a + r.pop, 0),
  };
}
