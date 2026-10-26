// 지역 정의. 좌표는 대략적인 경위도(lon, lat)이며 map.ts에서 화면 좌표로 투영한다.
// 장안·낙양·기주는 지도 밖 중원을 압축해서 왼쪽 가장자리에 배치했다.

export interface RegionDef {
  id: number;
  name: string;
  hanja: string;
  lon: number;
  lat: number;
  korea: boolean; // 삼한일통 승리 조건에 포함되는 지역
  pop: number;
  land: number;
  flood: number;
  forts: number;
}

export const REGION_DEFS: RegionDef[] = [
  { id: 1, name: "부여성", hanja: "扶餘城", lon: 124.8, lat: 43.0, korea: true, pop: 60000, land: 40, flood: 45, forts: 55 },
  { id: 2, name: "신성", hanja: "新城", lon: 123.9, lat: 41.88, korea: true, pop: 70000, land: 45, flood: 45, forts: 80 },
  { id: 3, name: "요동성", hanja: "遼東城", lon: 123.17, lat: 41.27, korea: true, pop: 110000, land: 55, flood: 50, forts: 90 },
  { id: 4, name: "안시성", hanja: "安市城", lon: 122.75, lat: 40.85, korea: true, pop: 60000, land: 45, flood: 45, forts: 95 },
  { id: 5, name: "비사성", hanja: "卑沙城", lon: 121.6, lat: 39.0, korea: true, pop: 40000, land: 35, flood: 40, forts: 75 },
  { id: 6, name: "오골성", hanja: "烏骨城", lon: 124.0, lat: 40.5, korea: true, pop: 50000, land: 40, flood: 40, forts: 75 },
  { id: 7, name: "국내성", hanja: "國內城", lon: 126.2, lat: 41.13, korea: true, pop: 90000, land: 50, flood: 50, forts: 75 },
  { id: 8, name: "책성", hanja: "柵城", lon: 130.3, lat: 42.87, korea: true, pop: 50000, land: 35, flood: 40, forts: 50 },
  { id: 9, name: "평양성", hanja: "平壤城", lon: 125.75, lat: 39.02, korea: true, pop: 200000, land: 65, flood: 60, forts: 90 },
  { id: 10, name: "수곡성", hanja: "水谷城", lon: 126.4, lat: 38.5, korea: true, pop: 60000, land: 45, flood: 45, forts: 60 },
  { id: 11, name: "비열홀", hanja: "比列忽", lon: 127.5, lat: 38.95, korea: true, pop: 50000, land: 40, flood: 40, forts: 50 },
  { id: 12, name: "한산주", hanja: "漢山州", lon: 127.2, lat: 37.5, korea: true, pop: 120000, land: 60, flood: 50, forts: 70 },
  { id: 13, name: "당항성", hanja: "黨項城", lon: 126.73, lat: 37.2, korea: true, pop: 50000, land: 45, flood: 45, forts: 55 },
  { id: 14, name: "우수주", hanja: "牛首州", lon: 127.73, lat: 37.88, korea: true, pop: 50000, land: 40, flood: 45, forts: 45 },
  { id: 15, name: "하슬라", hanja: "何瑟羅", lon: 128.9, lat: 37.75, korea: true, pop: 50000, land: 40, flood: 45, forts: 45 },
  { id: 16, name: "국원", hanja: "國原", lon: 127.93, lat: 36.99, korea: true, pop: 70000, land: 50, flood: 50, forts: 55 },
  { id: 17, name: "상주", hanja: "尙州", lon: 128.16, lat: 36.41, korea: true, pop: 90000, land: 55, flood: 55, forts: 55 },
  { id: 18, name: "금성", hanja: "金城", lon: 129.21, lat: 35.84, korea: true, pop: 180000, land: 70, flood: 60, forts: 80 },
  { id: 19, name: "대야성", hanja: "大耶城", lon: 128.17, lat: 35.57, korea: true, pop: 60000, land: 45, flood: 45, forts: 75 },
  { id: 20, name: "금관", hanja: "金官", lon: 128.88, lat: 35.23, korea: true, pop: 80000, land: 55, flood: 50, forts: 50 },
  { id: 21, name: "임존성", hanja: "任存城", lon: 126.75, lat: 36.7, korea: true, pop: 50000, land: 45, flood: 45, forts: 80 },
  { id: 22, name: "웅진", hanja: "熊津", lon: 127.2, lat: 36.55, korea: true, pop: 80000, land: 55, flood: 50, forts: 80 },
  { id: 23, name: "사비", hanja: "泗沘", lon: 126.7, lat: 36.25, korea: true, pop: 160000, land: 70, flood: 60, forts: 75 },
  { id: 24, name: "익산", hanja: "益山", lon: 127.0, lat: 35.85, korea: true, pop: 70000, land: 60, flood: 55, forts: 50 },
  { id: 25, name: "남원", hanja: "南原", lon: 127.38, lat: 35.41, korea: true, pop: 60000, land: 50, flood: 50, forts: 50 },
  { id: 26, name: "무진주", hanja: "武珍州", lon: 126.85, lat: 35.15, korea: true, pop: 80000, land: 55, flood: 50, forts: 45 },
  { id: 27, name: "영주", hanja: "營州", lon: 120.45, lat: 41.57, korea: false, pop: 80000, land: 45, flood: 45, forts: 70 },
  { id: 28, name: "유주", hanja: "幽州", lon: 116.4, lat: 39.9, korea: false, pop: 200000, land: 60, flood: 55, forts: 70 },
  { id: 29, name: "등주", hanja: "登州", lon: 120.8, lat: 37.8, korea: false, pop: 120000, land: 60, flood: 55, forts: 50 },
  { id: 30, name: "기주", hanja: "冀州", lon: 115.6, lat: 37.6, korea: false, pop: 250000, land: 70, flood: 55, forts: 65 },
  { id: 31, name: "낙양", hanja: "洛陽", lon: 115.6, lat: 34.9, korea: false, pop: 300000, land: 75, flood: 60, forts: 80 },
  { id: 32, name: "장안", hanja: "長安", lon: 114.95, lat: 33.85, korea: false, pop: 400000, land: 80, flood: 65, forts: 90 },
];

// [a, b, sea?]
const EDGES: [number, number, boolean?][] = [
  [1, 2], [1, 7], [1, 8],
  [2, 3], [2, 7], [2, 27],
  [3, 4], [3, 6], [3, 27],
  [4, 5], [4, 6], [4, 27],
  [5, 29, true],
  [6, 7], [6, 9],
  [7, 9], [7, 8],
  [8, 11],
  [9, 10], [9, 11],
  [10, 11], [10, 12],
  [11, 14], [11, 15],
  [12, 13], [12, 14], [12, 16],
  [13, 21], [13, 29, true],
  [14, 15], [14, 16],
  [15, 18],
  [16, 17], [16, 22],
  [17, 18], [17, 19], [17, 22],
  [18, 19], [18, 20],
  [19, 20], [19, 25],
  [21, 22], [21, 23],
  [22, 23],
  [23, 24], [23, 29, true],
  [24, 25], [24, 26],
  [25, 26],
  [27, 28],
  [28, 30],
  [30, 31], [30, 29],
  [31, 32], [31, 29],
];

export const ADJ: Map<number, number[]> = new Map();
export const SEA_EDGES = new Set<string>();
for (const def of REGION_DEFS) ADJ.set(def.id, []);
for (const [a, b, sea] of EDGES) {
  ADJ.get(a)!.push(b);
  ADJ.get(b)!.push(a);
  if (sea) SEA_EDGES.add(a < b ? `${a}-${b}` : `${b}-${a}`);
}
export const EDGE_LIST = EDGES;

export function isSea(a: number, b: number): boolean {
  return SEA_EDGES.has(a < b ? `${a}-${b}` : `${b}-${a}`);
}

export function regionDef(id: number): RegionDef {
  return REGION_DEFS[id - 1];
}
