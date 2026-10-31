// 엔진이 화면과 주고받는 인터페이스. ui/ 쪽에서 구현한다.
export interface Option {
  value: number;
  label: string;
  officer?: string; // 장수 id: 초상화 썸네일을 함께 보여 준다
  disabled?: boolean; // 보이되 고를 수 없다
}

// 원작 HEXDATA 지형 코드 0~6: 평지·초원·숲·산·물·구릉·성
export type Terrain = "plain" | "grass" | "forest" | "mountain" | "river" | "hill" | "castle";

export interface HexView {
  id: number;
  col: number;
  row: number;
  terrain: Terrain;
}

export interface UnitView {
  id: string;
  name: string;
  men: number;
  hex: number;
  side: "atk" | "def";
  color: string;
  ink: string;
  active: boolean; // 지금 명령을 받는 부대
  done: boolean; // 이번 날 행동을 마친 부대
  commander: boolean; // 총대장
  faction: string | null; // 부대 그림 선택용
}

export interface SideView {
  label: string;
  ruler: string | null; // 초상화용 장수 id
  men: number;
  generals: number; // 출전
  reserve: number; // 예비 (성에 남은 장수)
  food: number;
  gold: number;
}

export interface BattleView {
  regionId: number; // 지역별 전장 그림 선택용
  cols: number;
  rows: number;
  hexes: HexView[];
  units: UnitView[];
  hq: number;
  castles: number[];
  fires: number[];
  entries: number[]; // 공격측 진입 칸
  title: string;
  day: number;
  maxDay: number;
  weather: string;
  wind: string;
  atk: SideView;
  def: SideView;
  highlight: number[]; // 이동·배치 가능한 칸
  targets: number[]; // 대상 칸
}

// 전투 연출: 엔진이 행동 하나마다 알려 주면 화면이 부대 사이 움직임을 그린다
export interface BattleFx {
  kind: "attack" | "charge" | "fire" | "plot" | "duel" | "rout" | "burn";
  from: number; // 행동한 부대의 칸 (rout·burn은 대상 칸)
  to: number; // 대상 칸
  dmgTo?: number; // 대상의 손실
  dmgFrom?: number; // 행동한 부대의 손실
  ok?: boolean; // 화계·이간이 먹혔는가
  first?: boolean; // 돌격의 첫 타격 (이어지는 타격은 짧게)
}

export interface IO {
  say(text: string): void;
  clear(): void;
  pause(text?: string): Promise<void>;
  choose(prompt: string, options: Option[], opts?: { cancel?: boolean; columns?: number }): Promise<number | null>;
  number(prompt: string, min: number, max: number, def?: number): Promise<number | null>;
  confirm(prompt: string): Promise<boolean>;
  pickRegion(prompt: string, allowed: number[]): Promise<number | null>;
  refresh(focus?: number): void;
  table(rows: (string | number)[][], header?: string[]): void;
  showOfficer(id: string, title: string, lines: string[]): void; // 초상화 카드
  // 전술 전투
  showBattle(view: BattleView | null): void;
  pickHex(prompt: string, allowed: number[], labels?: Record<number, string>, cancelLabel?: string): Promise<number | null>;
  sleep(ms: number): Promise<void>;
  // 기록창 뒤 장면: "title" | "menu" | "spring"… | "cmd0"~"cmd19" | "battle". 화면이 없으면 구현하지 않아도 된다
  scene?(kind: string): void;
  // 전투 연출. 끝날 때까지 기다린다. 화면이 없으면 구현하지 않아도 된다
  battleFx?(fx: BattleFx): Promise<void>;
}
