// 엔진이 화면과 주고받는 인터페이스. ui/ 쪽에서 구현한다.
export interface Option {
  value: number;
  label: string;
  officer?: string; // 장수 id: 초상화 썸네일을 함께 보여 준다
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
}
