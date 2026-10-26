// 지역별 전장 지형 배치를 JSON으로 내보낸다 (전장 그림 생성용 기준 이미지의 원본)
import { REGION_DEFS } from "../src/data/regions";
import { COLS, ROWS, makeField } from "../src/engine/hex";

const out = REGION_DEFS.map((d) => {
  const f = makeField(d.id * 977 + 31, d.forts);
  return { id: d.id, name: d.name, cols: COLS, rows: ROWS, terrain: f.terrain, hq: f.hq, castles: f.castles };
});
console.log(JSON.stringify(out));
