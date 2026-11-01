// 역사 임무: 645년 안시성. 학생에게 보이는 문장은 근거의 성격을 태그로 밝힌다.
//   [기록] 사료에 있는 내용 / [전승] 후대의 이야기 / [가정] 학습을 위해 만든 상황 / [게임] 이 게임의 설정
// 근거: 『삼국사기』 권21 보장왕 4년, 『사료로 본 한국사』 고구려와 당의 전쟁, 한국민족문화대백과사전 「안시성전투」.
// 출처에서 확인하지 못한 일화(성주에게 비단을 내렸다는 이야기 등)는 넣지 않았다.
export type StatKey = "wall" | "food" | "morale" | "people";
export type Stats = Record<StatKey, number>;

export const STAT_LABEL: Record<StatKey, string> = { wall: "성벽", food: "군량", morale: "사기", people: "주민 여력" };

export interface MissionChoice {
  label: string;
  tag: "기록" | "전승" | "가정";
  delta: Partial<Stats>;
  result: string;
}

export interface MissionStep {
  date: string;
  title: string;
  facts: string[];
  card?: string; // 이 장면에서 만나는 인물
  question: string;
  choices: MissionChoice[];
  siege: Partial<Stats>; // 결정 뒤 당군의 공격과 시간이 줄이는 양
  record: string; // 회고에 나오는 실제 기록
}

export interface EvidenceCard {
  id: string;
  name: string;
  rows: string[];
}

export const EVIDENCE: Record<string, EvidenceCard> = {
  manchun: {
    id: "manchun",
    name: "안시성주",
    rows: [
      "[기록] 『삼국사기』는 '그 성주'라고만 적었고, 김부식도 이름이 전하지 않는다고 했습니다.",
      "[전승] '양만춘'이라는 이름은 16세기 명나라 소설 이후에 보이며, 조선에서는 윤근수의 『월정만필』부터 확인됩니다.",
      "[게임] 지력·무력·매력 수치와 생몰년은 게임을 위해 정한 값입니다.",
    ],
  },
  lishiji: {
    id: "lishiji",
    name: "이세적",
    rows: [
      "[기록] 645년 당군 선봉을 이끌고 요하를 건넜습니다.",
      "[기록] 태종이 건안성을 먼저 치자고 하자, 군량이 요동에 있어 보급로가 끊길 수 있다며 안시성을 먼저 치자고 답했습니다.",
      "[게임] 능력치는 게임을 위해 정한 값입니다.",
    ],
  },
  taizong: {
    id: "taizong",
    name: "당 태종 이세민",
    rows: [
      "[기록] 645년 직접 군대를 이끌고 고구려를 공격했습니다.",
      "[기록] 요동의 이른 추위와 군량 부족으로 안시성에서 철군을 명했습니다.",
      "[전승] 눈에 화살을 맞았다는 이야기는 후대 문헌에 전하며, 『삼국사기』 기록이 아닙니다.",
      "[게임] 능력치는 게임을 위해 정한 값입니다.",
    ],
  },
};

export const START: Stats = { wall: 70, food: 70, morale: 60, people: 60 };

export const INTRO = [
  "[기록] 645년 4월, 당군이 요하를 건너 개모성·비사성·요동성·백암성을 차례로 함락했습니다.",
  "[기록] 6월 20일, 당군이 안시성으로 진군합니다.",
  "[가정] 그대는 안시성주입니다. 세 번의 결정으로 9월까지 성을 지키십시오. 실제 성주가 이렇게 선택했다는 뜻은 아닙니다.",
  "[게임] 성벽·군량·사기·주민 여력은 상황을 단순화한 수치입니다. 하나라도 바닥나면 성을 지키지 못합니다. 주민 여력이 낮으면 지켜도 큰 희생이 남습니다.",
];

export const STEPS: MissionStep[] = [
  {
    date: "645년 6월",
    title: "구원군의 항복",
    card: "lishiji",
    facts: ["[기록] 안시성을 구하러 온 고연수·고혜진의 군대가 포위되어 항복했습니다.", "[기록] 당군은 보급로를 지키려고 안시성을 먼저 치기로 했습니다."],
    question: "[가정] 구원군이 사라졌습니다. 성 밖 마을을 어떻게 하겠습니까?",
    choices: [
      { label: "마을 사람들을 모두 성 안으로 들인다", tag: "가정", delta: { food: -20, people: 10, morale: 10 }, result: "성 안이 붐비지만 사람들은 함께 버틸 마음을 먹었습니다." },
      { label: "장정만 들여 성벽 일을 맡긴다", tag: "가정", delta: { food: -8, wall: 10, people: -15 }, result: "성벽은 단단해졌지만 남겨진 가족 걱정이 커졌습니다." },
      { label: "곡식만 거두어들인다", tag: "가정", delta: { food: 15, people: -25, morale: -10 }, result: "창고는 찼지만 마을 사람들의 원망이 큽니다." },
    ],
    siege: { wall: -15, food: -15 },
    record: "주민을 어떻게 했는지는 이번에 확인한 사료에 나오지 않습니다. 기록이 없는 부분은 역사가도 알 수 없습니다.",
  },
  {
    date: "645년 7~8월",
    title: "토산",
    card: "taizong",
    facts: ["[기록] 이도종이 성 동남쪽에 흙산을 쌓기 시작했습니다. 60일 동안 연인원 50만 명의 공력이 들어갔습니다.", "[기록] 토산 꼭대기에서는 성 안을 내려다볼 수 있었습니다."],
    question: "토산이 날마다 높아집니다. 어떻게 맞서겠습니까?",
    choices: [
      { label: "성벽을 높이고 무너진 곳에 목책을 세운다", tag: "기록", delta: { wall: 20, food: -5, people: -15 }, result: "밤낮 없는 공사로 사람들이 지쳐 갑니다." },
      { label: "토산 아래로 땅굴을 판다", tag: "전승", delta: { wall: 5, morale: 10, food: -5, people: -10 }, result: "몰래 파 들어가는 일이 사람들에게 희망을 줍니다." },
      { label: "밤에 나가 공사를 방해한다", tag: "가정", delta: { wall: -5, morale: 15, people: -5 }, result: "기습은 통했지만 성벽을 돌볼 손이 모자랍니다." },
    ],
    siege: { wall: -25, food: -15, people: -5 },
    record: "성 안에서 성벽을 높여 막고, 무너진 곳에는 목책을 세웠다고 기록되어 있습니다. 땅굴을 팠다는 주장은 확실하지 않습니다.",
  },
  {
    date: "645년 9월",
    title: "무너진 토산",
    facts: ["[기록] 토산이 무너져 성벽 한 귀퉁이가 부서졌습니다.", "[기록] 요동에 이른 추위가 찾아오고 당군의 군량도 줄고 있습니다."],
    question: "성벽이 뚫린 지금, 무엇을 먼저 하겠습니까?",
    choices: [
      { label: "무너진 틈으로 나가 토산을 차지한다", tag: "기록", delta: { wall: 10, morale: 15, people: -10 }, result: "토산을 빼앗자 내려다보던 적의 눈이 사라졌습니다." },
      { label: "먼저 무너진 성벽을 메운다", tag: "가정", delta: { wall: 20, morale: -5, food: -5, people: -5 }, result: "성은 다시 막혔지만 적은 토산에 그대로 있습니다." },
      { label: "성문을 열고 적 본진을 친다", tag: "가정", delta: { wall: -20, morale: 20, food: 5 }, result: "적의 군량 일부를 빼앗았지만 성은 그만큼 비었습니다." },
    ],
    siege: { wall: -25, food: -15, people: -5 },
    record: "고구려군이 무너진 틈으로 나와 토산을 차지했고, 당군은 3일 동안 공격했으나 되찾지 못했습니다.",
  },
];

export const ENDING_RECORD = [
  "[기록] 이른 추위로 풀이 마르고 물이 얼었으며, 군량도 떨어져 갔습니다. 태종은 철군을 명했습니다.",
  "[기록] 당군은 88일의 포위 끝에 9월 18일 물러났습니다.",
];

export interface QuizOption {
  label: string;
  kind: "기록" | "전승" | "게임";
  note: string;
}

// 사료로 확인되는 것을 고르는 질문. 게임 결과를 사실로 오해하지 않게 한다
export const QUIZ = {
  question: "다음 중 사료로 확인되는 내용은 무엇입니까?",
  options: [
    { label: "당군이 성 동남쪽에 토산을 쌓았다", kind: "기록", note: "맞습니다. 『삼국사기』에 기록되어 있습니다." },
    { label: "안시성주의 이름은 양만춘이다", kind: "전승", note: "후대의 이야기입니다. 『삼국사기』에는 성주의 이름이 없습니다." },
    { label: "주민 여력이 높아서 성을 지킬 수 있었다", kind: "게임", note: "이 임무의 수치일 뿐입니다. 실제 원인을 증명하지 않습니다." },
  ] as QuizOption[],
};

export const SOURCES = "출처: 『삼국사기』 권21 보장왕 4년 (한국 고대 사료 DB), 『사료로 본 한국사』 고구려와 당의 전쟁, 한국민족문화대백과사전 「안시성전투」";
