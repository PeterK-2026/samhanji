// 전장 그리기: 원작처럼 칸 경계가 보이지 않는 2D 지도 위에서 싸운다.
// 1순위: 지역별로 Codex가 그린 전장 그림(public/img/battlefields/<지역>.webp).
//        엔진의 지형 배치를 기준 이미지로 그렸으므로 지형·성 위치가 규칙과 맞는다.
// 2순위(그림이 없을 때): 이음매 없는 지형 질감을 이어 붙여 그린다.
// 부대는 나라별 병사 무리 그림 + 장수 초상 + 병력(백 단위, 총대장은 o)으로 표시한다.
import type { BattleFx, BattleView, Terrain } from "../engine/io";
import { battleTexImg, battlefieldImg, castleImg, officerImg, troopImg } from "./assets";

const SIZE = 30; // 헥스 반지름
const W = Math.sqrt(3) * SIZE;
const SVG_NS = "http://www.w3.org/2000/svg";
const TEX = 150;

const TEX_OF: Record<Terrain, string> = {
  plain: "plain", grass: "grass", forest: "forest", mountain: "mountain", river: "water", hill: "hill", castle: "plain",
};
const FLAG_CHAR: Record<string, string> = { goguryeo: "高", baekje: "百", silla: "新", tang: "唐" };

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export function hexCenter(col: number, row: number): [number, number] {
  return [W * (col + 0.5 * (row & 1)) + W / 2 + 6, SIZE * 1.5 * row + SIZE + 6];
}

const corners = (cx: number, cy: number, r = SIZE) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

export class BattleMap {
  onClick: (hex: number) => void = () => {};
  private built = "";
  private last: BattleView | null = null;
  private missingField = new Set<number>(); // 그림이 없는 지역
  private missingTroop = new Set<string>();

  constructor(private svg: SVGSVGElement) {}

  render(v: BattleView) {
    this.last = v;
    const painted = !this.missingField.has(v.regionId);
    const key = `${v.regionId}:${painted}:${v.cols}x${v.rows}:${v.hq}:${v.hexes.map((h) => h.terrain[0]).join("")}`;
    if (key !== this.built) this.build(v, key, painted);
    const sel = new Set(v.highlight);
    const tgt = new Set(v.targets);
    const entry = new Set(v.entries);
    for (const g of this.svg.querySelectorAll<SVGGElement>(".cell")) {
      const id = Number(g.dataset.id);
      g.classList.toggle("move", sel.has(id));
      g.classList.toggle("target", tgt.has(id));
      g.classList.toggle("entry", entry.has(id) && sel.has(id));
    }
    const fireLayer = this.svg.querySelector<SVGGElement>(".fires")!;
    fireLayer.replaceChildren();
    for (const id of v.fires) {
      const h = v.hexes[id - 1];
      const [cx, cy] = hexCenter(h.col, h.row);
      const f = el("g", { class: "flame", transform: `translate(${cx},${cy})` });
      f.append(el("circle", { r: SIZE * 0.95, fill: "url(#fire-glow)" }));
      for (const [dx, dy, s] of [[-8, 4, 1], [6, 2, 0.8], [0, -4, 1.2]]) {
        f.append(el("path", {
          d: `M${dx},${dy + 10 * s} C${dx - 8 * s},${dy} ${dx - 2 * s},${dy - 6 * s} ${dx},${dy - 14 * s} C${dx + 2 * s},${dy - 6 * s} ${dx + 8 * s},${dy} ${dx},${dy + 10 * s} Z`,
          class: "flame-tongue",
        }));
      }
      fireLayer.append(f);
    }
    this.drawUnits(v);
  }

  private rerender() {
    this.built = "";
    if (this.last) this.render(this.last);
  }

  private drawUnits(v: BattleView) {
    const layer = this.svg.querySelector<SVGGElement>(".units")!;
    layer.replaceChildren();
    for (const u of v.units) {
      const h = v.hexes[u.hex - 1];
      const [cx, cy] = hexCenter(h.col, h.row);
      const g = el("g", { class: `unit ${u.side}${u.active ? " active" : ""}${u.done ? " done" : ""}`, transform: `translate(${cx},${cy})`, "data-hex": u.hex });
      if (u.active) g.append(el("ellipse", { cx: 0, cy: 12, rx: 26, ry: 10, class: "halo" }));
      if (u.faction && !this.missingTroop.has(u.faction)) {
        // 나라별 병사 무리 그림
        const img = el("image", { href: troopImg(u.faction), x: -26, y: -34, width: 52, height: 52, class: "troop" });
        img.addEventListener("error", () => {
          this.missingTroop.add(u.faction!);
          this.drawUnits(v);
        }, { once: true });
        g.append(img);
      } else {
        // 그림이 없으면 깃발로 그린다
        g.append(el("ellipse", { cx: 0, cy: 16, rx: 17, ry: 5, class: "shadow" }));
        g.append(el("line", { x1: -10, y1: 16, x2: -10, y2: -24, class: "pole" }));
        g.append(el("path", { d: "M-10,-24 L16,-24 L13,-15 L16,-6 L-10,-6 Z", fill: u.color, class: "flag" }));
        const ch = el("text", { x: 2, y: -10.5, class: "flag-char", fill: u.ink });
        ch.textContent = (u.faction && FLAG_CHAR[u.faction]) || "兵";
        g.append(ch);
      }
      // 장수 초상 배지
      if (u.id !== "__militia") {
        g.append(el("circle", { cx: 17, cy: 4, r: 10.5, fill: u.color, class: "face-ring" }));
        const pic = el("image", { href: officerImg(u.id), x: 7, y: -6, width: 20, height: 20, "clip-path": "url(#face-clip)", preserveAspectRatio: "xMidYMid slice" });
        pic.addEventListener("error", () => pic.remove(), { once: true });
        g.append(pic);
      }
      // 병력 표시: 원작처럼 백 단위, 총대장은 앞에 o
      const tag = el("g", { class: "utag", transform: "translate(0,24)" });
      tag.append(el("rect", { x: -18, y: -7, width: 36, height: 13, rx: 2, class: "utag-bg", stroke: u.color }));
      const men = el("text", { y: 3, class: "umen" });
      men.textContent = `${u.commander ? "o" : ""}${Math.max(1, Math.round(u.men / 100))}`;
      tag.append(men);
      g.append(tag);
      const title = el("title", {});
      title.textContent = `${u.name} — 병사 ${u.men.toLocaleString("ko-KR")}${u.commander ? " (총대장)" : ""}`;
      g.append(title);
      layer.append(g);
    }
  }

  private build(v: BattleView, key: string, painted: boolean) {
    this.built = key;
    const width = W * (v.cols + 0.5) + 12;
    const height = SIZE * 1.5 * (v.rows - 1) + SIZE * 2 + 12;
    this.svg.setAttribute("viewBox", `0 0 ${width.toFixed(0)} ${height.toFixed(0)}`);
    this.svg.replaceChildren();

    const defs = el("defs", {});
    const clip = el("clipPath", { id: "face-clip" });
    clip.append(el("circle", { cx: 17, cy: 4, r: 9.5 }));
    defs.append(clip);
    const glow = el("radialGradient", { id: "fire-glow" });
    glow.append(el("stop", { offset: "0%", "stop-color": "#ffd25a", "stop-opacity": 0.85 }));
    glow.append(el("stop", { offset: "60%", "stop-color": "#e0582a", "stop-opacity": 0.55 }));
    glow.append(el("stop", { offset: "100%", "stop-color": "#8c1f0f", "stop-opacity": 0 }));
    defs.append(glow);
    this.svg.append(defs);

    if (painted) {
      const bg = el("image", { href: battlefieldImg(v.regionId), x: 0, y: 0, width, height, preserveAspectRatio: "none", class: "field-painting" });
      bg.addEventListener("error", () => {
        this.missingField.add(v.regionId);
        this.rerender();
      }, { once: true });
      this.svg.append(bg);
    } else {
      this.drawTextured(v, width, height, defs);
    }

    // 본성 표시 (그림 속 성 아래에 이름만 단다)
    const [hx, hy] = hexCenter(v.hexes[v.hq - 1].col, v.hexes[v.hq - 1].row);
    const hq = el("text", { x: hx, y: hy + 36, class: "hq-label" });
    hq.textContent = "본성";
    this.svg.append(hq);

    const cells = el("g", { class: "cells" });
    for (const h of v.hexes) {
      const [cx, cy] = hexCenter(h.col, h.row);
      const g = el("g", { class: `cell t-${h.terrain}`, "data-id": h.id });
      g.append(el("polygon", { points: corners(cx, cy, SIZE - 1) }));
      const num = el("text", { x: cx, y: cy + SIZE - 8, class: "hexnum" });
      num.textContent = String(h.id);
      g.append(num);
      g.addEventListener("click", () => this.onClick(h.id));
      cells.append(g);
    }
    this.svg.append(cells, el("g", { class: "fires" }), el("g", { class: "units" }), el("g", { class: "fx" }));
  }

  // ── 전투 연출 ──
  // 부대 사이의 움직임을 그리고, 엔진이 기다릴 시간(ms)을 돌려준다.
  // 부대 그룹은 다음 render()에서 새로 그려지므로 움직임은 그룹 안쪽 요소에 Web Animations로 건다.
  play(f: BattleFx): number {
    const v = this.last;
    const layer = this.svg.querySelector<SVGGElement>(".fx");
    if (!v || !layer) return 0;
    const at = (hex: number) => hexCenter(v.hexes[hex - 1].col, v.hexes[hex - 1].row);
    const [ax, ay] = at(f.from);
    const [tx, ty] = at(f.to);
    const unitAt = (hex: number) => this.svg.querySelector<SVGGElement>(`.unit[data-hex="${hex}"]`);
    const add = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, life: number) => {
      const e = el(tag, attrs);
      layer.append(e);
      setTimeout(() => e.remove(), life);
      return e;
    };
    // 떠오르는 손실 숫자
    const dmg = (x: number, y: number, n: number | undefined, big: boolean, delay: number) => {
      if (!n) return;
      const txt = add("text", { x, y: y - 26, class: big ? "fx-dmg" : "fx-dmg small" }, delay + 1150);
      txt.textContent = `-${n.toLocaleString("ko-KR")}`;
      txt.animate([
        { opacity: 0, transform: "translateY(4px)" },
        { opacity: 1, transform: "translateY(0)", offset: 0.15 },
        { opacity: 1, transform: "translateY(-8px)", offset: 0.7 },
        { opacity: 0, transform: "translateY(-22px)" },
      ], { duration: 1100, delay, easing: "ease-out", fill: "both" });
    };
    // 상대 쪽으로 몸을 던졌다 돌아오기
    const lunge = (hex: number, k: number, dur: number) => {
      const g = unitAt(hex);
      if (!g) return;
      const dx = (tx - ax) * k;
      const dy = (ty - ay) * k;
      for (const c of Array.from(g.children)) {
        (c as SVGElement).animate([
          { translate: "0px 0px" },
          { translate: `${dx}px ${dy}px`, offset: 0.45 },
          { translate: "0px 0px" },
        ], { duration: dur, easing: "cubic-bezier(.3,0,.2,1)" });
      }
    };
    const shake = (hex: number, delay: number) => {
      const g = unitAt(hex);
      if (!g) return;
      for (const c of Array.from(g.children)) {
        (c as SVGElement).animate([
          { translate: "0px 0px" }, { translate: "-3px 1px" }, { translate: "3px -1px" },
          { translate: "-2px 0px" }, { translate: "0px 0px" },
        ], { duration: 260, delay });
      }
    };
    // 부딪치는 섬광: 흰 빛 + 사방으로 튀는 선
    const spark = (x: number, y: number, delay: number, color = "#fff4c2") => {
      const outer = add("g", { transform: `translate(${x},${y - 6})` }, delay + 520);
      const g = el("g", { class: "fx-spark" });
      outer.append(g);
      g.append(el("circle", { r: 15, fill: color, opacity: 0.85 }));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        g.append(el("line", { x1: Math.cos(a) * 8, y1: Math.sin(a) * 8, x2: Math.cos(a) * 24, y2: Math.sin(a) * 24, stroke: color, "stroke-width": 2.5, "stroke-linecap": "round" }));
      }
      g.animate([
        { opacity: 0, transform: "scale(.3)" },
        { opacity: 1, transform: "scale(1)", offset: 0.3 },
        { opacity: 0, transform: "scale(1.3)" },
      ], { duration: 420, delay, fill: "both" });
    };
    // 흙먼지·연기
    const puff = (x: number, y: number, color: string, delay: number, life = 800) => {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const c = add("circle", { cx: x, cy: y + 8, r: 9, fill: color, opacity: 0, class: "fx-puff" }, delay + life + 50);
        c.animate([
          { opacity: 0.75, transform: "translate(0px,0px) scale(.5)" },
          { opacity: 0, transform: `translate(${Math.cos(a) * 18}px,${Math.sin(a) * 10 - 10}px) scale(1.6)` },
        ], { duration: life, delay, easing: "ease-out", fill: "both" });
      }
    };
    // 포물선으로 날아가는 불화살
    const arc = (dur: number, draw: (g: SVGGElement) => void) => {
      const g = add("g", {}, dur + 50);
      draw(g);
      const mx = (ax + tx) / 2;
      const my = Math.min(ay, ty) - 40 - Math.hypot(tx - ax, ty - ay) * 0.25;
      const frames = Array.from({ length: 9 }, (_, i) => {
        const t = i / 8;
        const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * mx + t * t * tx;
        const y = (1 - t) * (1 - t) * (ay - 10) + 2 * (1 - t) * t * my + t * t * (ty - 10);
        const nx = 2 * (1 - t) * (mx - ax) + 2 * t * (tx - mx);
        const ny = 2 * (1 - t) * (my - ay) + 2 * t * (ty - my);
        return { transform: `translate(${x}px,${y}px) rotate(${Math.atan2(ny, nx)}rad)`, offset: t };
      });
      g.animate(frames, { duration: dur, easing: "ease-in", fill: "both" });
    };
    // 한 점을 중심으로 커졌다 사라지는 불덩이
    const blaze = (delay: number, dur: number, peak: number) => {
      const outer = add("g", { transform: `translate(${tx},${ty})` }, delay + dur + 50);
      const c = el("circle", { r: 30, fill: "url(#fire-glow)", class: "fx-blaze" });
      outer.append(c);
      c.animate([
        { opacity: 0, transform: "scale(.2)" },
        { opacity: 1, transform: `scale(${peak})`, offset: 0.4 },
        { opacity: 0, transform: `scale(${peak + 0.2})` },
      ], { duration: dur, delay, fill: "both" });
    };

    switch (f.kind) {
      case "attack":
      case "charge": {
        const charge = f.kind === "charge";
        const follow = charge && !f.first;
        const dur = follow ? 260 : charge ? 620 : 520;
        lunge(f.from, charge ? 0.62 : 0.38, dur);
        if (charge && f.first) puff(ax, ay, "rgba(200,180,140,.7)", 0, 600);
        const hitAt = dur * 0.42;
        spark(tx, ty, hitAt, charge ? "#ffd25a" : "#fff4c2");
        shake(f.to, hitAt);
        dmg(tx, ty, f.dmgTo, true, hitAt);
        dmg(ax, ay, f.dmgFrom, false, hitAt + 80);
        return follow ? 300 : dur + 320;
      }
      case "fire": {
        arc(560, (g) => {
          g.append(el("line", { x1: -16, y1: 0, x2: 4, y2: 0, stroke: "#5a3a1a", "stroke-width": 2 }));
          g.append(el("circle", { cx: 6, cy: 0, r: 9, fill: "#e0582a", opacity: 0.4 }));
          g.append(el("circle", { cx: 6, cy: 0, r: 5, fill: "#ffb43a" }));
        });
        lunge(f.from, 0.12, 300);
        if (f.ok) blaze(540, 700, 1.25);
        else puff(tx, ty, "rgba(120,120,120,.7)", 560);
        return 1150;
      }
      case "plot": {
        const line = add("line", { x1: ax, y1: ay - 6, x2: tx, y2: ty - 6, class: "fx-plot", pathLength: 100 }, 1400);
        line.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], { duration: 600, fill: "both" });
        const outer = add("g", { transform: `translate(${tx},${ty - 34})` }, 1400);
        const mark = el("text", { x: 0, y: 8, class: f.ok ? "fx-mark ok" : "fx-mark" });
        mark.textContent = f.ok ? "成" : "失";
        outer.append(mark);
        mark.animate([
          { opacity: 0, transform: "scale(.4)" },
          { opacity: 1, transform: "scale(1.15)", offset: 0.6 },
          { opacity: 1, transform: "scale(1)" },
        ], { duration: 500, delay: 650, fill: "both" });
        return 1300;
      }
      case "duel": {
        const mx = (ax + tx) / 2;
        const my = (ay + ty) / 2 - 10;
        lunge(f.from, 0.3, 700);
        const g = add("g", {}, 1300);
        g.append(el("path", { d: `M${mx - 16} ${my - 16} L${mx + 16} ${my + 16} M${mx + 16} ${my - 16} L${mx - 16} ${my + 16}`, stroke: "#fff4c2", "stroke-width": 4, "stroke-linecap": "round" }));
        g.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1200, fill: "both" });
        for (let i = 0; i < 3; i++) spark(mx, my + 6, 200 + i * 260, "#ffd25a");
        return 1200;
      }
      case "rout":
        puff(tx, ty, "rgba(190,170,130,.8)", 0, 900);
        return 0;
      case "burn":
        blaze(0, 700, 1);
        dmg(tx, ty, f.dmgTo, true, 100);
        return 0;
    }
    return 0;
  }

  // 그림이 없을 때: 질감을 겹치는 원으로 칠한다
  private drawTextured(v: BattleView, width: number, height: number, defs: SVGDefsElement) {
    for (const name of new Set(Object.values(TEX_OF))) {
      const pat = el("pattern", { id: `tex-${name}`, patternUnits: "userSpaceOnUse", width: TEX, height: TEX });
      pat.append(el("image", { href: battleTexImg(name), width: TEX, height: TEX, preserveAspectRatio: "none" }));
      defs.append(pat);
    }
    const soft = el("filter", { id: "soft-edge", x: "-10%", y: "-10%", width: "120%", height: "120%" });
    soft.append(el("feGaussianBlur", { stdDeviation: 1.8 }));
    defs.append(soft);
    this.svg.append(el("rect", { x: 0, y: 0, width, height, fill: "url(#tex-plain)" }));
    const ground = el("g", { class: "ground", filter: "url(#soft-edge)" });
    for (const t of ["grass", "hill", "forest", "river", "mountain"] as Terrain[]) {
      for (const h of v.hexes) {
        if (h.terrain !== t) continue;
        const [cx, cy] = hexCenter(h.col, h.row);
        const fill = `url(#tex-${TEX_OF[t]})`;
        ground.append(el("circle", { cx, cy, r: SIZE * 1.02 + (((h.id * 37) % 7) - 3), fill }));
        for (const n of v.hexes) {
          if (n.id <= h.id || n.terrain !== t) continue;
          const [nx, ny] = hexCenter(n.col, n.row);
          if (Math.hypot(nx - cx, ny - cy) < W * 1.1) ground.append(el("circle", { cx: (cx + nx) / 2, cy: (cy + ny) / 2, r: SIZE * 0.85, fill }));
        }
      }
    }
    this.svg.append(ground);
    for (const h of v.hexes) {
      if (h.terrain !== "castle") continue;
      const [cx, cy] = hexCenter(h.col, h.row);
      const s = h.id === v.hq ? 70 : 54;
      this.svg.append(el("image", { href: castleImg, x: cx - s / 2, y: cy - s / 2 - 4, width: s, height: s, class: "castle" }));
    }
  }
}
