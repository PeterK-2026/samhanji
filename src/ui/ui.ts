import { regionDef } from "../data/regions";
import { FACTION_INFO } from "../data/scenarios";
import type { BattleView, IO, Option } from "../engine/io";
import { freeOfficersIn, menIn, officersIn, seasonName } from "../engine/state";
import type { FactionId, GameState } from "../engine/types";
import { officerImg, regionImg } from "./assets";
import { BattleMap } from "./battleMap";
import { josa } from "./josa";
import { MapView } from "./map";
import { buildScene } from "./scenes";

type Pending =
  | { kind: "choose"; options: Option[]; cancel: boolean; resolve: (v: number | null) => void }
  | { kind: "number"; min: number; max: number; resolve: (v: number | null) => void }
  | { kind: "confirm"; resolve: (v: boolean) => void }
  | { kind: "pause"; resolve: () => void }
  | { kind: "region" | "hex"; allowed: number[]; resolve: (v: number | null) => void };

// 같은 키 입력이 다음 프롬프트에 새어 들어가지 않도록 키 처리가 끝난 뒤 결과를 넘긴다
const later = (fn: () => void) => setTimeout(fn, 0);


// 이미지가 아직 없으면 조용히 숨긴다
function img(src: string, cls: string, alt = ""): HTMLImageElement {
  const e = document.createElement("img");
  e.className = cls;
  e.alt = alt;
  e.loading = "lazy";
  e.decoding = "async";
  e.addEventListener("error", () => e.remove(), { once: true });
  e.src = src;
  return e;
}

const h = (tag: string, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export class UI implements IO {
  state: GameState | null = null;
  private map: MapView;
  private battleMap: BattleMap;
  private mapSvg: SVGSVGElement;
  private battleSvg: SVGSVGElement;
  private battle: BattleView | null = null;
  private log: HTMLElement;
  private promptEl: HTMLElement;
  private optionsEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private inputRow: HTMLElement;
  private cancelBtn: HTMLElement;
  private infoEl: HTMLElement;
  private dateEl: HTMLElement;
  private stageEl: HTMLElement;
  private sceneKind = "";
  private pending: Pending | null = null;
  private focus: number | undefined;
  private swallowUntil = 0;
  private typeahead: string[] = [];
  private fresh = false; // 기본값이 채워진 상태: 첫 숫자 입력이 기본값을 대체한다

  constructor(root: HTMLElement) {
    const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
    this.mapSvg = $<SVGSVGElement>("#map");
    this.battleSvg = $<SVGSVGElement>("#battle");
    this.map = new MapView(this.mapSvg);
    this.battleMap = new BattleMap(this.battleSvg);
    this.battleMap.onClick = (id) => this.onHexClick(id);
    this.log = $("#log");
    this.promptEl = $("#prompt");
    this.optionsEl = $("#options");
    this.inputEl = $<HTMLInputElement>("#input");
    this.inputRow = $(".inputrow");
    this.cancelBtn = $("#cancel");
    this.infoEl = $("#info");
    this.dateEl = $("#date");
    this.stageEl = $("#stage");
    $("#ok").addEventListener("click", () => this.submitText());
    this.cancelBtn.addEventListener("click", () => this.cancel());
    // 키보드 입력은 문서 단위에서 직접 처리한다. 화면 키보드 등 처리하지 않은 입력만 기본 동작을 따른다.
    this.inputEl.addEventListener("beforeinput", (e) => {
      if (performance.now() < this.swallowUntil) e.preventDefault();
    });
    document.addEventListener("keydown", (e) => this.onKey(e));
    this.log.addEventListener("click", () => this.resolvePause());
    this.map.onClick = (id) => this.onRegionClick(id);
    this.setInputMode(false);
  }

  // ── IO 구현 ──
  say(text: string) {
    if (!text) return;
    this.log.append(h("p", "line", josa(text)));
    this.log.scrollTop = this.log.scrollHeight;
  }

  clear() {
    this.log.replaceChildren();
  }

  table(rows: (string | number)[][], header?: string[]) {
    const t = h("table", "tbl");
    if (header) {
      const tr = h("tr");
      for (const c of header) tr.append(h("th", undefined, c));
      t.append(tr);
    }
    for (const r of rows) {
      const tr = h("tr");
      for (const c of r) tr.append(h("td", typeof c === "number" ? "n" : undefined, String(c)));
      t.append(tr);
    }
    const wrap = h("div", "tblwrap");
    wrap.append(t);
    this.log.append(wrap);
    this.log.scrollTop = this.log.scrollHeight;
  }

  showOfficer(id: string, title: string, lines: string[]) {
    const card = h("div", "ocard");
    card.append(img(officerImg(id), "portrait", title));
    const body = h("div", "ocard-body");
    body.append(h("div", "ocard-title", josa(title)));
    for (const l of lines) if (l) body.append(h("div", "ocard-line", josa(l)));
    card.append(body);
    this.log.append(card);
    this.log.scrollTop = this.log.scrollHeight;
  }

  pause(text = "계속하려면 아무 키나 누르십시오"): Promise<void> {
    return new Promise((resolve) => {
      this.begin({ kind: "pause", resolve }, text);
      this.optionsEl.style.setProperty("--cols", "1");
      const b = h("button", "btn primary", "계속 ▶");
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this.resolvePause();
      });
      this.optionsEl.append(b);
    });
  }

  choose(prompt: string, options: Option[], opts: { cancel?: boolean; columns?: number } = {}): Promise<number | null> {
    return new Promise((resolve) => {
      this.begin({ kind: "choose", options, cancel: !!opts.cancel, resolve }, prompt);
      this.optionsEl.style.setProperty("--cols", String(opts.columns ?? 3));
      for (const o of options) {
        const b = h("button", "btn opt");
        b.append(h("span", "key", String(o.value)));
        if (o.officer) b.append(img(officerImg(o.officer), "thumb"));
        b.append(h("span", "lbl", o.label));
        b.addEventListener("click", () => this.finish(o.value));
        this.optionsEl.append(b);
      }
      this.setInputMode(true, !!opts.cancel);
      this.inputEl.placeholder = "번호 입력";
    });
  }

  number(prompt: string, min: number, max: number, def?: number): Promise<number | null> {
    return new Promise((resolve) => {
      this.begin({ kind: "number", min, max, resolve }, prompt);
      this.typeahead = []; // 수량은 미리 친 키로 정하지 않는다
      this.optionsEl.style.setProperty("--cols", "4");
      const quick = [...new Set([min, def, Math.floor(max / 2), max])].filter(
        (v): v is number => v !== undefined && v >= min && v <= max,
      );
      for (const v of quick) {
        const b = h("button", "btn opt", v === max ? `최대 ${v}` : v === def ? `권장 ${v}` : String(v));
        b.addEventListener("click", () => this.finish(v));
        this.optionsEl.append(b);
      }
      this.setInputMode(true, true);
      this.inputEl.value = def !== undefined ? String(def) : "";
      this.fresh = def !== undefined;
      this.inputEl.placeholder = `${min} ~ ${max}`;
      this.inputEl.select();
    });
  }

  confirm(prompt: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.begin({ kind: "confirm", resolve }, `${prompt} (Y/N)`);
      this.optionsEl.style.setProperty("--cols", "2");
      const y = h("button", "btn primary", "예 (Y)");
      const n = h("button", "btn", "아니오 (N)");
      y.addEventListener("click", () => this.finishConfirm(true));
      n.addEventListener("click", () => this.finishConfirm(false));
      this.optionsEl.append(y, n);
    });
  }

  pickRegion(prompt: string, allowed: number[]): Promise<number | null> {
    return new Promise((resolve) => {
      if (!allowed.length) return resolve(null);
      this.begin({ kind: "region", allowed, resolve }, `${prompt} — 지도를 누르거나 번호 입력`);
      this.optionsEl.style.setProperty("--cols", "3");
      for (const id of allowed) {
        const r = this.state!.regions[id - 1];
        const b = h("button", "btn opt chip");
        b.append(h("span", "key", String(id)), h("span", "lbl", r.name));
        b.style.setProperty("--chip", r.owner ? FACTION_INFO[r.owner].color : "var(--empty)");
        b.addEventListener("click", () => this.finish(id));
        this.optionsEl.append(b);
      }
      this.setInputMode(true, true);
      this.inputEl.placeholder = "지역 번호";
      this.renderMap(allowed);
    });
  }

  scene(kind: string) {
    if (kind === this.sceneKind) return;
    this.sceneKind = kind;
    this.stageEl.replaceChildren(buildScene(kind, this.state?.month ?? 1));
  }

  showBattle(view: BattleView | null) {
    if (view && !this.battle) this.scene("battle");
    this.battle = view;
    this.mapSvg.toggleAttribute("hidden", !!view);
    this.battleSvg.toggleAttribute("hidden", !view);
    if (view) {
      this.battleMap.render(view);
      this.renderBattleInfo(view);
    } else this.refresh();
  }

  pickHex(prompt: string, allowed: number[], labels?: Record<number, string>, cancelLabel = "취소"): Promise<number | null> {
    return new Promise((resolve) => {
      if (!allowed.length) return resolve(null);
      this.begin({ kind: "hex", allowed, resolve }, `${prompt} — 전장을 누르거나 칸 번호 입력`);
      this.optionsEl.style.setProperty("--cols", "3");
      if (labels) {
        for (const id of allowed) {
          const b = h("button", "btn opt");
          b.append(h("span", "key", String(id)), h("span", "lbl", labels[id] ?? ""));
          b.addEventListener("click", () => this.finish(id));
          this.optionsEl.append(b);
        }
      }
      const skip = h("button", "btn", cancelLabel);
      skip.addEventListener("click", () => this.finish(null));
      this.optionsEl.append(skip);
      this.setInputMode(true, false);
      this.inputEl.placeholder = "칸 번호 (Esc = " + cancelLabel + ")";
    });
  }

  sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  refresh(focus?: number) {
    if (focus !== undefined) this.focus = focus;
    const s = this.state;
    if (!s) {
      this.dateEl.textContent = "";
      this.infoEl.replaceChildren();
      return;
    }
    this.dateEl.textContent = this.preview ? "" : `${s.year}년 ${s.month}월 · ${seasonName(s.month)}`;
    if (this.battle) return;
    this.renderMap();
    this.renderInfo(this.focus);
  }

  private preview = false;

  // preview: 타이틀 화면처럼 세력도만 보여 줄 때 (날짜·정보 패널은 비운다)
  setState(s: GameState | null, preview = false) {
    this.state = s;
    this.preview = preview;
    this.focus = undefined;
    this.refresh();
    if (preview) {
      this.dateEl.textContent = "";
      this.infoEl.replaceChildren(h("p", "hint", "642년 세력도 — 고구려·백제·신라·당이 한반도와 만주를 두고 맞서고 있습니다."));
    }
  }

  // ── 내부 ──
  private viewer(focus: number | undefined): FactionId | null {
    const s = this.state!;
    const f = focus ? s.regions[focus - 1].owner : null;
    if (f && s.factions[f].player) return f;
    return Object.values(s.factions).find((x) => x.player && x.alive)?.id ?? null;
  }

  private renderMap(selectable?: number[]) {
    if (this.state) this.map.render(this.state, this.focus, selectable);
  }

  private renderInfo(focus: number | undefined) {
    const s = this.state!;
    this.infoEl.replaceChildren();
    if (!focus) {
      this.infoEl.append(h("p", "hint", "지도의 지역을 누르면 정보를 볼 수 있습니다."));
      return;
    }
    const r = s.regions[focus - 1];
    const d = regionDef(r.id);
    const owner = r.owner ? s.factions[r.owner] : null;
    const ruler = owner?.ruler ? s.officers[owner.ruler].name : "—";
    const offs = officersIn(s, r.id);
    const viewer = this.viewer(focus);
    const known = !!r.owner && (r.owner === viewer || (viewer !== null && r.spiedBy.includes(viewer)));
    const q = (v: number) => (known ? v.toLocaleString("ko-KR") : "?");
    const free = freeOfficersIn(s, r.id).filter((o) => !o.hidden).length;

    const head = h("div", "info-head");
    const seal = h("div", "seal", owner ? owner.name[0] : "空");
    seal.style.background = r.owner ? FACTION_INFO[r.owner].color : "var(--empty)";
    seal.style.color = r.owner ? FACTION_INFO[r.owner].ink : "var(--ink)";
    const title = h("div", "info-title");
    title.append(h("div", "rname", `${r.id}. ${r.name}`), h("div", "rhanja", d.hanja));
    const meta = h("div", "info-meta");
    meta.append(h("div", undefined, `세력 ${owner?.name ?? "공백지"}`), h("div", undefined, `군주 ${ruler}`));
    if (r.delegated) meta.append(h("div", "tag", "위임 중"));
    head.append(seal, title, meta);

    const grid = h("div", "stats");
    const n = (v: number) => v.toLocaleString("ko-KR");
    const cells: [string, string, string][] = [
      ["인구", n(r.pop), "c1"], ["금", q(r.gold), "c2"], ["민심", known ? String(r.loyalty) : "?", "c3"],
      ["병사", n(menIn(s, r.id)), "c1"], ["군량", q(r.food), "c2"], ["개발", String(r.land), "c3"],
      ["장수", String(offs.length), "c1"], ["세율", known ? String(r.rate) : "?", "c2"], ["치수", String(r.flood), "c3"],
      ["재야", known ? String(free) : "?", "c1"], ["군마", q(r.horses), "c2"], ["성곽", String(r.forts), "c3"],
    ];
    for (const [k, v, c] of cells) {
      const cell = h("div", `stat ${c}`);
      cell.append(h("span", "k", k), h("span", "v", v));
      grid.append(cell);
    }
    const banner = h("div", "banner");
    banner.append(img(regionImg(r.id), "banner-img", r.name));
    if (owner?.ruler && s.officers[owner.ruler]) banner.append(img(officerImg(owner.ruler), "banner-ruler", ruler));
    this.infoEl.append(banner, head, grid);
    if (offs.length && (known || r.owner === viewer)) {
      const chips = h("div", "chips");
      for (const o of offs) {
        const chip = h("span", "chip-o");
        chip.append(img(officerImg(o.id), "chip-img"), h("span", undefined, `${o.name} ${o.men.toLocaleString("ko-KR")}`));
        chips.append(chip);
      }
      this.infoEl.append(chips);
    }
  }

  // 원작 전투 패널: 지명·날짜·날씨·바람, 양측 군주 초상과 병사/장수(출전/예비)/군량/금
  private renderBattleInfo(v: BattleView) {
    this.infoEl.replaceChildren();
    const top = h("div", "btop");
    top.append(
      h("span", "btitle", v.title), h("span", undefined, `${v.day}일째 / ${v.maxDay}일`),
      h("span", "bweather", v.weather), h("span", "bwind", v.wind),
    );
    const n = (x: number) => x.toLocaleString("ko-KR");
    const col = (sv: BattleView["def"], role: string) => {
      const c = h("div", "bside");
      const head = h("div", "bside-head");
      if (sv.ruler) head.append(img(officerImg(sv.ruler), "bside-img"));
      head.append(h("div", "bside-name", `${sv.label} (${role})`));
      c.append(head);
      for (const [k, val] of [["병사", n(sv.men)], ["장수", `${sv.generals} / ${sv.reserve}`], ["군량", n(sv.food)], ["금", n(sv.gold)]]) {
        const row = h("div", "stat");
        row.append(h("span", "k", k), h("span", "v", val));
        c.append(row);
      }
      return c;
    };
    const cols = h("div", "bsides");
    cols.append(col(v.def, "수비"), col(v.atk, "공격"));
    this.infoEl.append(top, cols, h("div", "officers", "帥 총대장 · 城 성(본성에 공격측이 들어가면 함락) · 불은 바람을 따라 번짐 · 장수 = 출전 / 예비"));
  }

  private begin(p: Pending, prompt: string) {
    this.pending = p;
    later(() => this.drain());
    this.promptEl.textContent = josa(prompt);
    this.optionsEl.replaceChildren();
    this.setInputMode(false);
  }

  private setInputMode(on: boolean, cancel = false) {
    this.inputRow.hidden = !on;
    this.cancelBtn.hidden = !cancel;
    this.inputEl.value = "";
    this.fresh = false;
    this.inputEl.classList.remove("bad");
    if (on && window.matchMedia("(pointer: fine)").matches) this.inputEl.focus({ preventScroll: true });
  }

  private finish(v: number | null) {
    const p = this.pending;
    if (!p || p.kind === "confirm" || p.kind === "pause") return;
    this.pending = null;
    this.end();
    if (p.kind === "region") this.renderMap();
    later(() => p.resolve(v));
  }

  private finishConfirm(v: boolean) {
    const p = this.pending;
    if (!p || p.kind !== "confirm") return;
    this.pending = null;
    this.end();
    later(() => p.resolve(v));
  }

  private resolvePause() {
    const p = this.pending;
    if (!p || p.kind !== "pause") return;
    this.pending = null;
    this.end();
    later(() => p.resolve());
  }

  private end() {
    this.promptEl.textContent = "";
    this.optionsEl.replaceChildren();
    this.setInputMode(false);
  }

  private cancel() {
    const p = this.pending;
    if (!p) return;
    if (p.kind === "choose" && p.cancel) this.finish(null);
    else if (p.kind === "number" || p.kind === "region" || p.kind === "hex") this.finish(null);
    else if (p.kind === "confirm") this.finishConfirm(false);
  }

  private submitText() {
    const p = this.pending;
    if (!p) return;
    const raw = this.inputEl.value.trim();
    const v = Number(raw);
    if (raw === "" && p.kind === "choose" && p.cancel) return this.finish(null);
    if (raw === "" || !Number.isInteger(v)) return this.flash();
    if (p.kind === "choose" && p.options.some((o) => o.value === v)) return this.finish(v);
    if (p.kind === "number" && v >= p.min && v <= p.max) return this.finish(v);
    if ((p.kind === "region" || p.kind === "hex") && p.allowed.includes(v)) return this.finish(v);
    this.flash();
  }

  private flash() {
    this.inputEl.classList.remove("bad");
    void this.inputEl.offsetWidth;
    this.inputEl.classList.add("bad");
  }

  private onHexClick(id: number) {
    const p = this.pending;
    if (p?.kind === "hex" && p.allowed.includes(id)) this.finish(id);
  }

  private onRegionClick(id: number) {
    const p = this.pending;
    if (p?.kind === "region") {
      if (p.allowed.includes(id)) this.finish(id);
      return;
    }
    if (!this.state) return;
    this.renderInfo(id);
  }

  private onKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key === "Tab") return;
    if (e.target instanceof HTMLButtonElement && (e.key === "Enter" || e.key === " ")) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!/^([0-9yn ]|Enter|Escape|Backspace)$/.test(key)) return;
    e.preventDefault();
    this.swallowUntil = performance.now() + 60;
    if (!this.pending || this.typeahead.length) {
      // 다음 프롬프트가 열리기 전에 누른 키는 모아 두었다가 순서대로 처리한다
      if (this.typeahead.length < 8) this.typeahead.push(key);
      this.drain();
      return;
    }
    this.handleKey(key);
  }

  private drain() {
    while (this.pending && this.typeahead.length) this.handleKey(this.typeahead.shift()!);
  }

  private handleKey(key: string) {
    const p = this.pending;
    if (!p) return;
    if (p.kind === "pause") return this.resolvePause();
    if (p.kind === "confirm") {
      if (key === "y" || key === "Enter") this.finishConfirm(true);
      else if (key === "n" || key === "Escape") this.finishConfirm(false);
      return;
    }
    if (key === "Enter") return this.submitText();
    if (key === "Escape") return this.cancel();
    if (key === "Backspace") {
      this.inputEl.value = this.fresh ? "" : this.inputEl.value.slice(0, -1);
      this.fresh = false;
      return;
    }
    if (!/^[0-9]$/.test(key)) return;
    let next = (this.fresh ? "" : this.inputEl.value.replace(/\D/g, "")) + key;
    this.fresh = false;
    if (p.kind === "choose" || p.kind === "region" || p.kind === "hex") {
      const values = (p.kind === "choose" ? p.options.map((o) => o.value) : p.allowed).map(String);
      // 어떤 번호와도 맞지 않으면 새로 친 숫자부터 다시 시작한다
      if (!values.some((x) => x.startsWith(next))) next = values.some((x) => x.startsWith(key)) ? key : "";
      this.inputEl.value = next;
      // 이 번호로 시작하는 더 긴 번호가 없으면 Enter 없이 바로 결정
      const longer = values.some((x) => x.startsWith(next) && x !== next);
      if (next && values.includes(next) && !longer) this.finish(Number(next));
      return;
    }
    this.inputEl.value = next;
  }
}
