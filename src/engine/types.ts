export type FactionId = "silla" | "baekje" | "goguryeo" | "tang";

export const FACTION_IDS: FactionId[] = ["goguryeo", "baekje", "silla", "tang"];

export interface Officer {
  id: string;
  name: string;
  born: number;
  died: number;
  int: number; // 지력
  war: number; // 무력
  chr: number; // 매력
  loy: number; // 충성
  men: number; // 병사
  trn: number; // 훈련
  arm: number; // 무장
  faction: FactionId | null; // null = 재야
  region: number;
  hidden: boolean; // 재야 장수가 아직 발견되지 않음
  alive: boolean;
}

export interface Region {
  id: number;
  name: string;
  owner: FactionId | null;
  pop: number; // 인구
  gold: number; // 금
  food: number; // 군량
  rate: number; // 세율
  loyalty: number; // 민심
  land: number; // 개발
  flood: number; // 치수
  horses: number; // 군마
  forts: number; // 성곽
  delegated: boolean;
  spiedBy: FactionId[]; // 이번 달 첩보로 정보가 공개된 세력
}

export interface Faction {
  id: FactionId;
  name: string;
  ruler: string | null;
  alive: boolean;
  player: boolean;
}

export type Mode = "history" | "fiction";

export interface GameState {
  version: 1;
  scenarioId: number;
  year: number;
  month: number; // 1..12
  mode: Mode;
  difficulty: 1 | 2 | 3;
  showOtherBattles: boolean;
  regions: Region[]; // index = id - 1
  officers: Record<string, Officer>;
  spawned: string[]; // 등장 처리된 장수 id
  factions: Record<FactionId, Faction>;
  relations: Record<string, number>; // "a|b" 0..100
  alliances: string[]; // "a|b"
  queue: number[]; // 이번 달 남은 지역 순서
  foodPrice: number; // 100석당 금
  lastWar?: Partial<Record<FactionId, number>>; // AI가 마지막으로 출병한 때 (year*12+month). 예전 저장에는 없다
  over: boolean;
}

export function pairKey(a: FactionId, b: FactionId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
