import type { FactionId } from "../engine/types";

export interface ScenarioDef {
  id: number;
  title: string;
  year: number;
  summary: string;
  factionNames?: Partial<Record<FactionId, string>>;
  rulers: Partial<Record<FactionId, string>>; // 없는 세력은 등장하지 않음
  owners: Record<number, FactionId>; // 지역 id → 세력 (없으면 공백지)
  placements: Record<number, string[]>; // 지역 id → 장수 id
  absent: string[]; // 이 시나리오에서 재야로도 등장하지 않는 인물
  alliances: [FactionId, FactionId][];
  relations: [FactionId, FactionId, number][];
}

// 지역 번호 대역: 1~11 고구려 본토, 12~20 신라, 21~26 백제, 27~32 당
function range(a: number, b: number, f: FactionId): Record<number, FactionId> {
  const r: Record<number, FactionId> = {};
  for (let i = a; i <= b; i++) r[i] = f;
  return r;
}

const BASE_OWNERS = {
  ...range(1, 11, "goguryeo"),
  ...range(12, 20, "silla"),
  ...range(21, 26, "baekje"),
  ...range(27, 32, "tang"),
};

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 1,
    title: "대야성의 비극",
    year: 642,
    summary: "백제 의자왕이 신라 서쪽 40여 성을 노리고, 고구려에서는 연개소문이 정변을 꾀한다.",
    rulers: { silla: "seondeok", baekje: "uija", goguryeo: "yeongnyu", tang: "taizong" },
    owners: BASE_OWNERS,
    placements: {
      18: ["seondeok", "chunchu", "yongchun", "bidam", "gangsu"],
      17: ["yusin", "heumsun"],
      19: ["pumseok", "jukjuk", "geomil"],
      12: ["pumil", "cheonjon"],
      13: ["jukji"],
      14: ["yeomjong"],
      15: ["alcheon"],
      16: ["yangdo"],
      20: ["beopmin"],
      23: ["uija", "seongchung", "heungsu", "yung", "sangyeong", "chungsang"],
      22: ["yesikjin", "tae"],
      21: ["boksin"],
      24: ["dochim", "pung"],
      25: ["yunchung", "gyebaek"],
      26: ["eunsang", "jisusin", "satasangyeo"],
      9: ["yeongnyu", "bojang", "gaesomun", "jeongui", "sinseong"],
      4: ["manchun"],
      3: ["yeonsu"],
      2: ["hyejin"],
      7: ["geommojam", "goyeonmu"],
      6: ["sondaeeum"],
      10: ["jeongto"],
      32: ["taizong", "zhangsun", "fang", "weizheng", "lijing"],
      31: ["cheng", "yuchi"],
      30: ["ashina", "wangwendu"],
      28: ["lishiji", "qibi", "seolgyedu"],
      27: ["lidaozong", "sudingfang"],
      29: ["zhangliang", "liurengui"],
    },
    absent: [],
    alliances: [],
    relations: [
      ["goguryeo", "baekje", 60], ["silla", "tang", 60], ["silla", "baekje", 10],
      ["silla", "goguryeo", 20], ["tang", "goguryeo", 25], ["tang", "baekje", 40],
    ],
  },
  {
    id: 2,
    title: "안시성 전투",
    year: 645,
    summary: "당 태종이 친히 대군을 이끌고 요하를 건넌다. 연개소문은 보장왕을 앞세워 맞선다.",
    rulers: { silla: "seondeok", baekje: "uija", goguryeo: "bojang", tang: "taizong" },
    owners: { ...BASE_OWNERS, 19: "baekje" },
    placements: {
      18: ["seondeok", "chunchu", "yongchun", "bidam", "yeomjong", "gangsu"],
      17: ["yusin", "heumsun"],
      12: ["pumil", "cheonjon"],
      13: ["jukji"],
      14: ["inmun"],
      15: ["alcheon"],
      16: ["yangdo"],
      20: ["beopmin"],
      23: ["uija", "seongchung", "heungsu", "yung", "sangyeong", "chungsang"],
      19: ["yunchung", "geomil"],
      25: ["gyebaek"],
      22: ["yesikjin", "tae"],
      21: ["boksin"],
      24: ["dochim", "pung"],
      26: ["eunsang", "jisusin", "satasangyeo"],
      9: ["bojang", "gaesomun", "jeongto", "sinseong"],
      4: ["manchun"],
      3: ["yeonsu", "hyejin", "jeongui"],
      2: ["geommojam"],
      7: ["goyeonmu"],
      6: ["sondaeeum"],
      32: ["taizong", "zhangsun", "fang", "lijing", "gaozong"],
      31: ["cheng", "yuchi"],
      27: ["lishiji", "lidaozong", "qibi", "ashina"],
      28: ["xuerengui", "seolgyedu"],
      29: ["zhangliang", "liurengui"],
      30: ["wangwendu", "sudingfang"],
    },
    absent: ["pumseok", "jukjuk", "yeongnyu", "weizheng"],
    alliances: [["silla", "tang"]],
    relations: [
      ["goguryeo", "baekje", 70], ["silla", "tang", 80], ["silla", "baekje", 5],
      ["silla", "goguryeo", 15], ["tang", "goguryeo", 5], ["tang", "baekje", 30],
    ],
  },
  {
    id: 3,
    title: "황산벌",
    year: 660,
    summary: "나당 연합군이 백제를 향해 진군한다. 계백의 결사대 5천이 황산벌에서 기다린다.",
    rulers: { silla: "chunchu", baekje: "uija", goguryeo: "bojang", tang: "gaozong" },
    owners: { ...BASE_OWNERS, 19: "baekje" },
    placements: {
      18: ["chunchu", "alcheon", "gangsu", "inmun"],
      17: ["yusin", "heumsun", "pumil", "gwanchang", "bangul", "wonsul"],
      12: ["cheonjon", "jukji"],
      13: ["yangdo"],
      16: ["beopmin"],
      23: ["uija", "heungsu", "yung", "sangyeong", "chungsang", "eunsang"],
      25: ["gyebaek"],
      22: ["yesikjin", "tae"],
      21: ["boksin", "heukchi", "jisusin"],
      24: ["dochim"],
      26: ["satasangyeo"],
      19: ["yunchung", "geomil"],
      9: ["bojang", "gaesomun", "namsaeng", "namgeon", "namsan", "jeongto", "sinseong"],
      4: ["manchun"],
      3: ["hyejin"],
      7: ["geommojam", "goyeonmu"],
      6: ["sondaeeum"],
      32: ["gaozong"],
      31: ["cheng", "liurenyuan"],
      29: ["sudingfang", "wangwendu", "liurengui"],
      27: ["lishiji", "qibi"],
      28: ["xuerengui", "ligeunhaeng"],
      30: ["gaokan", "panghyotae"],
    },
    absent: ["pung", "seongchung"],
    alliances: [["silla", "tang"], ["goguryeo", "baekje"]],
    relations: [
      ["goguryeo", "baekje", 80], ["silla", "tang", 85], ["silla", "baekje", 5],
      ["silla", "goguryeo", 10], ["tang", "goguryeo", 5], ["tang", "baekje", 10],
    ],
  },
  {
    id: 4,
    title: "나당전쟁",
    year: 670,
    summary: "백제와 고구려가 무너진 뒤, 당은 한반도 전체를 노린다. 문무왕은 고구려 부흥군과 손잡는다.",
    factionNames: { goguryeo: "고구려 부흥군" },
    rulers: { silla: "beopmin", goguryeo: "anseung", tang: "gaozong" },
    owners: {
      ...range(1, 9, "tang"),
      10: "goguryeo",
      11: "goguryeo",
      ...range(12, 20, "silla"),
      ...range(21, 24, "tang"),
      25: "silla",
      26: "silla",
      ...range(27, 32, "tang"),
    },
    placements: {
      18: ["beopmin", "inmun", "gangsu"],
      17: ["yusin", "heumsun"],
      12: ["cheonjon", "jukji", "wonsul"],
      13: ["yangdo", "seolouyu"],
      16: ["pumil"],
      19: ["jeongto"],
      10: ["anseung", "geommojam", "goyeonmu"],
      9: ["xuerengui", "namsaeng"],
      23: ["liurenyuan", "yung"],
      22: ["yesikjin", "heukchi", "satasangyeo"],
      3: ["gaokan"],
      27: ["ligeunhaeng"],
      29: ["liurengui"],
      28: ["qibi"],
      32: ["gaozong"],
    },
    absent: [
      "bojang", "namgeon", "namsan", "sinseong", "uija", "tae", "pung", "jisusin",
      "sangyeong", "chungsang", "sondaeeum", "manchun",
    ],
    alliances: [["silla", "goguryeo"]],
    relations: [["silla", "goguryeo", 85], ["silla", "tang", 15], ["tang", "goguryeo", 0]],
  },
];

export const HEIRS: Record<FactionId, string[]> = {
  silla: ["jindeok", "chunchu", "beopmin", "inmun"],
  baekje: ["yung", "tae", "pung"],
  goguryeo: ["bojang", "anseung"],
  tang: ["gaozong"],
};

export const FACTION_INFO: Record<FactionId, { name: string; color: string; ink: string }> = {
  goguryeo: { name: "고구려", color: "#b5442f", ink: "#fff" },
  baekje: { name: "백제", color: "#2f6d9a", ink: "#fff" },
  silla: { name: "신라", color: "#c8962b", ink: "#1b1408" },
  tang: { name: "당", color: "#6b4a8c", ink: "#fff" },
};
