// 기록창 뒤에 깔리는 움직이는 그림 (수묵 실루엣 풍). 고른 명령·계절에 따라 장면이 바뀐다.
// 도형은 모두 SVG로 그리고, 움직임은 style.css의 .a-* 키프레임이 맡는다 (prefers-reduced-motion이면 멈춘다).
import { FACTION_INFO } from "../data/scenarios";

const NS = "http://www.w3.org/2000/svg";
type Kid = SVGElement | null | false;

function s(tag: string, attrs: Record<string, string | number> = {}, ...kids: Kid[]): SVGElement {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  for (const k of kids) if (k) e.append(k);
  return e;
}
const g = (attrs: Record<string, string | number>, ...kids: Kid[]) => s("g", attrs, ...kids);
const at = (x: number, y: number, k = 1) => `translate(${x} ${y}) scale(${k})`;
// 애니메이션 시간·지연을 CSS 변수로 넘긴다
const anim = (cls: string, vars: Record<string, string | number> = {}) => ({
  class: cls,
  style: Object.entries(vars).map(([k, v]) => `--${k}:${v}`).join(";"),
});
// 장면마다 같은 배치가 나오도록 고정된 의사 난수
const rnd = (i: number, salt = 1) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const INK = "#3a2a1a";
const W = 600;
const GROUND = 172;

// ── 공용 요소 ──
function mountains(): SVGElement {
  return g({},
    s("path", { d: "M0 140 L60 92 L110 118 L170 70 L240 116 L300 84 L360 120 L430 66 L500 112 L560 88 L600 104 L600 200 L0 200 Z", fill: INK, opacity: 0.08 }),
    s("path", { d: "M0 160 L80 122 L150 146 L220 110 L300 150 L380 118 L460 148 L530 120 L600 140 L600 200 L0 200 Z", fill: INK, opacity: 0.11 }),
  );
}
const ground = () => s("path", { d: `M0 ${GROUND} Q150 ${GROUND - 6} 300 ${GROUND} T600 ${GROUND} L600 200 L0 200 Z`, fill: INK, opacity: 0.16 });
const caption = (ko: string, hanja: string) =>
  g({ class: "scene-cap" },
    s("text", { x: W - 14, y: 26, "text-anchor": "end", class: "cap-hanja" }, text(hanja)),
    s("text", { x: W - 14, y: 44, "text-anchor": "end", class: "cap-ko" }, text(ko)),
  );
function text(t: string): SVGElement {
  const e = s("tspan");
  e.textContent = t;
  return e;
}

function cloud(x: number, y: number, t: number, d: number): SVGElement {
  return g(anim("a-drift", { t: `${t}s`, d: `${d}s` }),
    s("path", { d: `M${x} ${y} q12 -14 28 -6 q10 -12 26 -2 q16 -2 16 10 z`, fill: "#fff", opacity: 0.5 }));
}

function soldier(x: number, color: string, k = 1, spear = true): SVGElement {
  return g({ transform: at(x, GROUND, k) },
    g(anim("a-bob"),
      s("path", { d: "M-4 0 L-1 -14 M4 0 L1 -14", stroke: INK, "stroke-width": 2.4, "stroke-linecap": "round" }),
      s("path", { d: "M-7 -14 L7 -14 L5 -32 L-5 -32 Z", fill: color }),
      s("circle", { cx: 0, cy: -37, r: 5, fill: INK }),
      s("path", { d: "M-6 -39 Q0 -49 6 -39 Z", fill: INK }),
      spear && s("path", { d: "M9 -4 L13 -64 M11 -70 L15 -62 L11 -64 Z", stroke: INK, "stroke-width": 1.6, fill: INK }),
    ));
}

function banner(x: number, color: string, h = 70, hanja = ""): SVGElement {
  const top = GROUND - h;
  return g({},
    s("line", { x1: x, y1: GROUND, x2: x, y2: top - 6, stroke: INK, "stroke-width": 2.5 }),
    g(anim("a-wave", { d: `${rnd(x) * -1.5}s` }),
      s("path", { d: `M${x} ${top} L${x + 44} ${top + 4} L${x + 40} ${top + 22} L${x + 46} ${top + 40} L${x} ${top + 36} Z`, fill: color }),
      !!hanja && s("text", { x: x + 20, y: top + 26, "text-anchor": "middle", class: "flag-char" }, text(hanja)),
    ));
}

function palace(x: number, k = 1): SVGElement {
  return g({ transform: at(x, GROUND, k) },
    s("rect", { x: -90, y: -14, width: 180, height: 14, fill: INK, opacity: 0.55 }),
    ...[-66, -33, 0, 33, 66].map((px) => s("rect", { x: px - 3, y: -50, width: 6, height: 36, fill: "#7a2418" })),
    s("path", { d: "M-108 -50 Q-60 -54 -40 -70 L40 -70 Q60 -54 108 -50 L96 -46 L-96 -46 Z", fill: INK }),
    s("path", { d: "M-60 -70 Q-30 -76 -20 -88 L20 -88 Q30 -76 60 -70 Z", fill: INK }),
  );
}

function pine(x: number, k = 1): SVGElement {
  return g({ transform: at(x, GROUND, k) },
    s("path", { d: "M-3 0 Q-6 -40 2 -80", stroke: INK, "stroke-width": 5, fill: "none" }),
    g(anim("a-sway"),
      s("ellipse", { cx: -14, cy: -60, rx: 22, ry: 7, fill: INK, opacity: 0.8 }),
      s("ellipse", { cx: 14, cy: -74, rx: 20, ry: 6, fill: INK, opacity: 0.8 }),
      s("ellipse", { cx: 0, cy: -88, rx: 14, ry: 5, fill: INK, opacity: 0.8 }),
    ));
}

function person(x: number, color: string, k = 1, cls = ""): SVGElement {
  return g({ transform: at(x, GROUND, k) },
    g(cls ? anim(cls) : {},
      s("path", { d: "M-9 0 L9 0 L5 -30 L-5 -30 Z", fill: color }),
      s("circle", { cx: 0, cy: -35, r: 5, fill: INK }),
      s("rect", { x: -5, y: -46, width: 10, height: 6, rx: 1, fill: INK }),
    ));
}

function ox(x: number): SVGElement {
  return g({ transform: at(x, GROUND) },
    g(anim("a-bob"),
      s("ellipse", { cx: 0, cy: -20, rx: 22, ry: 11, fill: INK }),
      s("circle", { cx: 22, cy: -24, r: 7, fill: INK }),
      s("path", { d: "M20 -30 q-3 -7 -8 -6 M26 -30 q3 -7 8 -6", stroke: INK, "stroke-width": 2, fill: "none" }),
      s("path", { d: "M-14 -10 L-15 0 M-6 -10 L-6 0 M8 -10 L8 0 M15 -10 L16 0", stroke: INK, "stroke-width": 3 }),
    ));
}

function wheel(cx: number, cy: number, r: number): SVGElement {
  return g(anim("a-spin"),
    s("circle", { cx, cy, r, fill: "none", stroke: INK, "stroke-width": 2.5 }),
    s("path", { d: `M${cx - r} ${cy} L${cx + r} ${cy} M${cx} ${cy - r} L${cx} ${cy + r}`, stroke: INK, "stroke-width": 1.5 }),
  );
}

// 계절 입자: 꽃잎·비·낙엽·눈
function particles(kind: "spring" | "summer" | "autumn" | "winter", n = 18): SVGElement {
  const kids: SVGElement[] = [];
  for (let i = 0; i < n; i++) {
    const x = rnd(i, 3) * W;
    const t = kind === "summer" ? 0.9 + rnd(i, 5) * 0.5 : 6 + rnd(i, 5) * 6;
    const vars = { t: `${t.toFixed(2)}s`, d: `${(-rnd(i, 7) * t).toFixed(2)}s`, dx: `${kind === "summer" ? -18 : 20 + rnd(i, 9) * 50}px` };
    const shape =
      kind === "spring" ? s("ellipse", { cx: x, cy: 0, rx: 3, ry: 1.8, fill: "#e8a3b4" })
      : kind === "summer" ? s("line", { x1: x, y1: 0, x2: x - 4, y2: 12, stroke: "#5b7c99", "stroke-width": 1.2, opacity: 0.6 })
      : kind === "autumn" ? s("path", { d: `M${x} 0 q4 -4 8 0 q-4 4 -8 0`, fill: i % 2 ? "#b5541e" : "#c8962b" })
      : s("circle", { cx: x, cy: 0, r: 1.5 + rnd(i, 11) * 1.5, fill: "#fff" });
    kids.push(g(anim(kind === "summer" ? "a-rain" : "a-fall", vars), shape));
  }
  return g({}, ...kids);
}

export function seasonOf(month: number): "spring" | "summer" | "autumn" | "winter" {
  return month <= 3 ? "spring" : month <= 6 ? "summer" : month <= 9 ? "autumn" : "winter";
}

function sky(night = false): SVGElement {
  return s("rect", { x: 0, y: 0, width: W, height: 200, fill: night ? "#2b3346" : "transparent", opacity: night ? 0.35 : 0 });
}

function moon(x: number, y: number): SVGElement {
  return g({},
    s("circle", { cx: x, cy: y, r: 22, fill: "#f6ecd0", opacity: 0.9 }),
    s("circle", { cx: x, cy: y, r: 34, fill: "#f6ecd0", opacity: 0.15, class: "a-glow" }),
  );
}

function stars(n = 14): SVGElement {
  return g({}, ...Array.from({ length: n }, (_, i) =>
    s("circle", { cx: rnd(i, 13) * W, cy: 40 + rnd(i, 17) * 60, r: 1.2, fill: "#fff", ...anim("a-twinkle", { d: `${(-rnd(i, 19) * 3).toFixed(2)}s` }) })));
}

const FC = (f: keyof typeof FACTION_INFO) => FACTION_INFO[f].color;

// ── 장면 ──
type Builder = (season: ReturnType<typeof seasonOf>) => SVGElement[];

const SCENES: Record<string, Builder> = {
  title: () => [
    mountains(), cloud(40, 40, 50, 0), cloud(300, 60, 60, -25), ground(),
    banner(120, FC("goguryeo"), 86, "高"), banner(230, FC("baekje"), 74, "百"), banner(340, FC("silla"), 80, "新"), banner(450, FC("tang"), 92, "唐"),
    g(anim("a-birds"), ...[0, 1, 2].map((i) => s("path", { d: `M${60 + i * 22} ${50 + (i % 2) * 8} q6 -6 12 0 q6 -6 12 0`, stroke: INK, fill: "none", "stroke-width": 1.5 }))),
  ],
  menu: (season) => [mountains(), cloud(80, 40, 55, -10), ground(), pine(70, 1.1), palace(330, 1.15), banner(208, "#8c2f1f", 70), banner(452, "#8c2f1f", 70), particles(season)],
  spring: () => [mountains(), ground(), pine(90), palace(360), particles("spring", 26), caption("봄", "春")],
  summer: () => [mountains(), ground(), pine(90), palace(360), particles("summer", 40), caption("여름", "夏")],
  autumn: () => [mountains(), ground(), pine(90), palace(360), particles("autumn", 22), caption("가을", "秋")],
  winter: () => [mountains(), ground(), pine(90), palace(360), particles("winter", 34), caption("겨울", "冬")],

  // 0 휴식: 달밤
  cmd0: () => [sky(true), stars(), moon(470, 78), mountains(), ground(), pine(120, 1.1), palace(330),
    g(anim("a-glow"), s("circle", { cx: 250, cy: 138, r: 7, fill: "#f2b84b" })), caption("휴식", "休息")],
  // 1 이동: 행군
  cmd1: () => [mountains(), ground(),
    g(anim("a-march", { t: "16s" }), ...[0, 1, 2, 3, 4, 5].map((i) => soldier(-i * 34, i === 0 ? "#8c2f1f" : "#6b5a44")), banner(-208, "#8c2f1f", 60)),
    g(anim("a-dust"), s("ellipse", { cx: 300, cy: GROUND + 4, rx: 200, ry: 6, fill: INK, opacity: 0.08 })), caption("이동", "移動")],
  // 2 수송: 소달구지
  cmd2: () => [mountains(), ground(),
    g(anim("a-march", { t: "20s" }),
      ox(30),
      s("path", { d: `M8 ${GROUND - 24} L-6 ${GROUND - 18}`, stroke: INK, "stroke-width": 2 }),
      s("rect", { x: -60, y: GROUND - 40, width: 54, height: 20, fill: "#7a5a32" }),
      s("ellipse", { cx: -46, cy: GROUND - 44, rx: 10, ry: 7, fill: "#d8c08a" }), s("ellipse", { cx: -24, cy: GROUND - 45, rx: 11, ry: 8, fill: "#cdb37a" }),
      wheel(-33, GROUND - 10, 11),
      soldier(-86, "#6b5a44", 0.9, false)),
    caption("수송", "輸送")],
  // 3 전쟁: 북과 화살
  cmd3: () => [mountains(), ground(),
    banner(70, "#8c2f1f", 92), banner(130, "#8c2f1f", 80),
    g({ transform: at(190, GROUND) }, s("rect", { x: -4, y: -34, width: 8, height: 34, fill: INK }),
      g(anim("a-beat"), s("ellipse", { cx: 0, cy: -46, rx: 22, ry: 18, fill: "#7a2418" }), s("ellipse", { cx: 0, cy: -46, rx: 14, ry: 11, fill: "#e8d6a8" }))),
    ...[0, 1, 2, 3, 4].map((i) => g(anim("a-arrow-x", { d: `${-i * 0.45}s` }), g(anim("a-arrow-y", { d: `${-i * 0.45}s` }),
      s("path", { d: `M230 ${110 + i * 6} l26 -4 M252 ${105 + i * 6} l6 1 l-5 4`, stroke: INK, "stroke-width": 1.6, fill: INK })))),
    ...[0, 1, 2, 3].map((i) => soldier(400 + i * 40, "#2f4a6b", 1)),
    caption("전쟁", "戰爭")],
  // 4 군사: 창술 훈련
  cmd4: () => [mountains(), ground(), banner(80, "#8c2f1f", 80),
    ...[0, 1, 2, 3, 4].map((i) => g(anim("a-thrust", { d: `${i * 0.12}s` }), soldier(170 + i * 70, "#6b5a44"))),
    caption("군사", "軍事")],
  // 5 인재: 소나무 아래 선비와 등불
  cmd5: () => [mountains(), ground(), pine(380, 1.3), person(330, "#e8e0cf"),
    g(anim("a-march", { t: "18s" }), person(0, "#8c2f1f", 1, "a-bob"),
      s("line", { x1: 10, y1: GROUND - 34, x2: 20, y2: GROUND - 54, stroke: INK, "stroke-width": 1.5 }),
      g(anim("a-glow"), s("circle", { cx: 21, cy: GROUND - 48, r: 6, fill: "#f2b84b" }))),
    caption("인재", "人才")],
  // 6 외교: 두 성문 사이를 오가는 사신
  cmd6: () => [mountains(), ground(),
    g({ transform: at(70, GROUND) }, s("rect", { x: -40, y: -60, width: 80, height: 60, fill: INK, opacity: 0.6 }), s("rect", { x: -12, y: -34, width: 24, height: 34, fill: "#e6d7b8" })),
    g({ transform: at(530, GROUND) }, s("rect", { x: -40, y: -60, width: 80, height: 60, fill: INK, opacity: 0.6 }), s("rect", { x: -12, y: -34, width: 24, height: 34, fill: "#e6d7b8" })),
    banner(120, "#8c2f1f", 76), banner(470, "#2f4a6b", 76),
    g(anim("a-envoy"), person(0, "#c8962b", 1, "a-bob"), s("rect", { x: 8, y: GROUND - 30, width: 10, height: 8, fill: "#7a2418" })),
    caption("외교", "外交")],
  // 7 첩보: 달밤 지붕 위의 그림자
  cmd7: () => [sky(true), stars(10), moon(120, 76), mountains(), ground(), palace(300, 1.1),
    g(anim("a-sneak"), g({ transform: at(0, GROUND - 80, 0.8) },
      s("path", { d: "M-6 0 L6 0 L4 -26 L-4 -26 Z", fill: "#111" }), s("circle", { cx: 0, cy: -31, r: 5, fill: "#111" }))),
    g({ transform: at(520, 100) }, g(anim("a-blink"), s("ellipse", { cx: 0, cy: 0, rx: 16, ry: 8, fill: "#f6ecd0" }), s("circle", { cx: 0, cy: 0, r: 5, fill: INK }))),
    caption("첩보", "諜報")],
  // 8 정보: 두루마리 지도
  cmd8: () => [mountains(), ground(),
    s("rect", { x: 140, y: 66, width: 320, height: 98, fill: "#f3e7c9", stroke: INK, "stroke-width": 1.5 }),
    s("rect", { x: 128, y: 60, width: 14, height: 110, rx: 5, fill: "#7a2418" }), s("rect", { x: 458, y: 60, width: 14, height: 110, rx: 5, fill: "#7a2418" }),
    s("path", { d: "M170 146 Q200 100 240 118 T320 92 T400 128 T440 100", ...anim("a-draw", { len: 400, t: "5s" }), stroke: INK, "stroke-width": 2, fill: "none" }),
    s("path", { d: "M200 84 L230 108 L280 104 L330 138", ...anim("a-draw", { len: 200, t: "5s", d: "1s" }), stroke: "#8c2f1f", "stroke-width": 1.5, fill: "none", "stroke-dasharray": "4 3" }),
    ...[[240, 118], [320, 92], [400, 128]].map(([x, y], i) => s("circle", { cx: x, cy: y, r: 4, fill: "#8c2f1f", ...anim("a-twinkle", { d: `${-i}s` }) })),
    caption("정보", "情報")],
  // 9 개간: 소가 쟁기를 끌고 싹이 자란다
  cmd9: () => [mountains(), ground(),
    ...Array.from({ length: 12 }, (_, i) => s("path", { d: `M${30 + i * 48} ${GROUND + 2} q4 -14 0 -22 q-4 8 0 22`, fill: "#5f7d3a", ...anim("a-grow", { d: `${-(i % 6) * 0.5}s` }) })),
    g(anim("a-march", { t: "22s" }), ox(40), s("path", { d: `M18 ${GROUND - 20} L-14 ${GROUND - 6} L-20 ${GROUND + 2}`, stroke: INK, "stroke-width": 2.5, fill: "none" }), person(-40, "#6b5a44", 0.9, "a-bob")),
    caption("개간", "開墾")],
  // 10 치수: 흐르는 강과 둑
  cmd10: () => [mountains(),
    g(anim("a-flow"), s("path", { d: wave(GROUND - 6, 1200), fill: "#5b7c99", opacity: 0.55 })),
    g(anim("a-flow", { t: "6s" }), s("path", { d: wave(GROUND + 4, 1200), fill: "#7b9cb9", opacity: 0.5 })),
    ...Array.from({ length: 7 }, (_, i) => s("rect", { x: 150 + i * 44, y: GROUND - 34, width: 40, height: 16, rx: 3, fill: "#8f7a50", ...anim("a-stack", { d: `${i * 0.35}s` }) })),
    caption("치수", "治水")],
  // 11 포상: 떨어지는 금전
  cmd11: () => [mountains(), ground(),
    g({ transform: at(300, GROUND) }, s("rect", { x: -50, y: -40, width: 100, height: 40, fill: "#7a2418" }), s("rect", { x: -54, y: -48, width: 108, height: 10, fill: "#5a1a10" })),
    ...Array.from({ length: 10 }, (_, i) => g(anim("a-coin", { d: `${(-i * 0.37).toFixed(2)}s` }),
      s("ellipse", { cx: 260 + rnd(i, 23) * 80, cy: 0, rx: 7, ry: 7, fill: "#d6a93c", stroke: "#8a6a1c", "stroke-width": 1.5 }))),
    person(170, "#6b5a44", 1, "a-bow"), person(430, "#8c2f1f", 1.05),
    caption("포상", "褒賞")],
  // 12 시혜: 곡식 나눠 주기
  cmd12: () => [mountains(), ground(),
    ...[0, 1, 2].map((i) => s("ellipse", { cx: 120 + i * 30, cy: GROUND - 12, rx: 16, ry: 12, fill: "#d8c08a", stroke: "#8f7a50" })),
    person(220, "#8c2f1f", 1.05),
    ...[0, 1, 2, 3].map((i) => person(310 + i * 46, i % 2 ? "#a08a66" : "#8f7a50", 0.95, "a-bow")),
    ...Array.from({ length: 8 }, (_, i) => g(anim("a-fall", { t: "2.5s", d: `${-i * 0.3}s`, dx: "6px" }), s("circle", { cx: 240 + i * 4, cy: 100, r: 1.6, fill: "#c8962b" }))),
    caption("시혜", "施惠")],
  // 13 상인: 저울
  cmd13: () => [mountains(), ground(),
    g({ transform: at(300, GROUND) }, s("path", { d: "M0 0 L0 -90 M-20 0 L20 0", stroke: INK, "stroke-width": 4 }),
      g(anim("a-tilt"), s("line", { x1: -80, y1: -90, x2: 80, y2: -90, stroke: INK, "stroke-width": 3 }),
        s("path", { d: "M-80 -90 L-96 -60 L-64 -60 Z M80 -90 L64 -60 L96 -60 Z", fill: "none", stroke: INK }),
        s("ellipse", { cx: -80, cy: -64, rx: 14, ry: 9, fill: "#d8c08a" }), s("ellipse", { cx: 80, cy: -63, rx: 9, ry: 5, fill: "#d6a93c" }))),
    person(140, "#2f4a6b"), person(460, "#8c2f1f"),
    caption("상인", "商人")],
  // 14 세율: 주판
  cmd14: () => [mountains(), ground(),
    s("rect", { x: 180, y: 84, width: 240, height: 80, rx: 6, fill: "#7a5a32" }), s("rect", { x: 190, y: 92, width: 220, height: 64, fill: "#e8d6a8" }),
    s("line", { x1: 190, y1: 110, x2: 410, y2: 110, stroke: "#7a5a32", "stroke-width": 3 }),
    ...Array.from({ length: 9 }, (_, i) => g({},
      s("line", { x1: 204 + i * 24, y1: 92, x2: 204 + i * 24, y2: 156, stroke: "#7a5a32" }),
      s("ellipse", { cx: 204 + i * 24, cy: 101, rx: 9, ry: 5, fill: INK }),
      s("ellipse", { cx: 204 + i * 24, cy: 140, rx: 9, ry: 5, fill: INK, ...anim("a-bead", { d: `${-rnd(i, 29) * 2}s` }) }))),
    caption("세율", "稅率")],
  // 15 세력: 네 나라 깃발
  cmd15: () => [mountains(), ground(),
    banner(110, FC("goguryeo"), 96, "高"), banner(230, FC("baekje"), 70, "百"), banner(350, FC("silla"), 84, "新"), banner(470, FC("tang"), 104, "唐"),
    caption("세력", "勢力")],
  // 16 위임: 도장 찍기
  cmd16: () => [mountains(), ground(),
    s("rect", { x: 200, y: 110, width: 200, height: 56, fill: "#f3e7c9", stroke: INK }),
    ...[0, 1, 2].map((i) => s("line", { x1: 216, y1: 124 + i * 12, x2: 330, y2: 124 + i * 12, stroke: INK, opacity: 0.5 })),
    s("rect", { x: 346, y: 120, width: 34, height: 34, fill: "none", stroke: "#b3261e", "stroke-width": 3, ...anim("a-mark") }),
    g(anim("a-stamp"), s("rect", { x: 348, y: 70, width: 30, height: 34, rx: 3, fill: "#7a2418" }), s("rect", { x: 356, y: 50, width: 14, height: 22, rx: 6, fill: INK })),
    caption("위임", "委任")],
  // 17 추방: 성문을 떠나는 사람
  cmd17: () => [mountains(), ground(),
    g({ transform: at(110, GROUND) }, s("rect", { x: -60, y: -80, width: 120, height: 80, fill: INK, opacity: 0.6 }), s("path", { d: "M-20 0 L-20 -44 Q0 -60 20 -44 L20 0 Z", fill: "#e6d7b8" })),
    g(anim("a-leave"), person(0, "#8f7a50", 1, "a-bob"), s("ellipse", { cx: -10, cy: GROUND - 26, rx: 7, ry: 9, fill: "#cdb37a" })),
    caption("추방", "追放")],
  // 18 조언: 깃털 부채를 든 책사
  cmd18: () => [sky(true), stars(12), mountains(), ground(), pine(470, 1.2),
    g({ transform: at(280, GROUND, 1.3) }, s("path", { d: "M-10 0 L10 0 L6 -32 L-6 -32 Z", fill: "#e8e0cf" }), s("circle", { cx: 0, cy: -37, r: 5, fill: INK }),
      s("path", { d: "M-6 -42 L6 -42 L4 -50 L-4 -50 Z", fill: INK }),
      g(anim("a-fan"), s("path", { d: "M8 -24 L22 -44 Q30 -40 26 -30 Z", fill: "#f6ecd0", stroke: INK, "stroke-width": 0.8 }))),
    caption("조언", "助言")],
  // 19 기타: 붓글씨
  cmd19: () => [mountains(), ground(),
    s("rect", { x: 170, y: 66, width: 260, height: 100, fill: "#f3e7c9", stroke: INK }),
    s("path", { d: "M220 92 L260 92 M240 82 L240 140 M210 120 Q240 110 270 126 M300 88 L300 150 M290 106 L340 102 M320 82 Q330 120 360 148 M370 96 Q380 112 372 140", ...anim("a-draw", { len: 600, t: "6s" }), stroke: INK, "stroke-width": 5, "stroke-linecap": "round", fill: "none" }),
    caption("기타", "其他")],
  battle: () => [mountains(), ground(),
    ...[0, 1, 2, 3].map((i) => soldier(60 + i * 36, "#8c2f1f")), ...[0, 1, 2, 3].map((i) => soldier(420 + i * 36, "#2f4a6b")),
    banner(30, "#8c2f1f", 90), banner(560, "#2f4a6b", 90),
    ...[0, 1, 2, 3, 4, 5].map((i) => g(anim("a-arrow-x", { d: `${-i * 0.35}s` }), g(anim("a-arrow-y", { d: `${-i * 0.35}s` }),
      s("path", { d: `M200 ${108 + i * 4} l26 -4 M222 ${103 + i * 4} l6 1 l-5 4`, stroke: INK, "stroke-width": 1.6, fill: INK })))),
    caption("전투", "戰鬪")],
};

function wave(y: number, w: number): string {
  let d = `M0 ${y}`;
  for (let x = 0; x < w; x += 60) d += ` q15 -8 30 0 t30 0`;
  return `${d} L${w} 200 L0 200 Z`;
}

export const SCENE_KINDS = Object.keys(SCENES);

export function buildScene(kind: string, month: number): SVGSVGElement {
  const svg = s("svg", { viewBox: `0 0 ${W} 200`, preserveAspectRatio: "xMidYMax slice", "aria-hidden": "true" }) as SVGSVGElement;
  for (const k of (SCENES[kind] ?? SCENES.menu)(seasonOf(month))) svg.append(k);
  return svg;
}
