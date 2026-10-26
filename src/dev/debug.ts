// 브라우저 디버그 모드. 주소에 ?debug 를 붙이면 켜진다.
//   ?debug&scenario=3&play=silla&seed=42&diff=2&mode=fiction&watch=1
//   - scenario가 있으면 타이틀·설정 화면을 건너뛰고 바로 시작한다 (play를 비우면 관전, 여러 나라는 쉼표로)
//   - seed가 있으면 Math.random을 시드 난수로 바꿔 같은 진행을 재현한다
// 왼쪽 아래 패널에서 자원 지급, N개월 자동 진행, 불변식 검사, 상태 내보내기·가져오기, 전투 속도를 바꿀 수 있다.
import { SCENARIOS } from "../data/scenarios";
import { MAX_FOOD, MAX_GOLD } from "../engine/economy";
import { createGame, menCap } from "../engine/state";
import { FACTION_IDS, type FactionId, type GameState, type Mode } from "../engine/types";
import type { UI } from "../ui/ui";
import { checkInvariants } from "./check";
import { seedRandom } from "./seed";

const params = new URLSearchParams(location.search);
export const DEBUG = params.has("debug");

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...kids);
  return e;
}

function select(options: [string, string][], selected: string): HTMLSelectElement {
  const s = el("select");
  for (const [value, label] of options) s.append(new Option(label, value, value === selected, value === selected));
  return s;
}

export class DebugPanel {
  private s: GameState | null = null;
  private root: HTMLElement;
  private out: HTMLPreElement;
  private status: HTMLSpanElement;
  private months: HTMLSelectElement;
  private autoBtn: HTMLButtonElement;
  private autoUntil: number | null = null; // year*12+month
  private autoPlayers: FactionId[] = [];
  private speed = 1;
  private seed: number | null;

  constructor(private ui: UI) {
    const seed = Number(params.get("seed") ?? NaN);
    this.seed = Number.isFinite(seed) ? seed : null;
    if (this.seed !== null) seedRandom(this.seed);

    // 전투 애니메이션 속도 조절
    const sleep = ui.sleep.bind(ui);
    ui.sleep = (ms: number) => (this.speed === 0 ? Promise.resolve() : sleep(ms * this.speed));
    // 자동 진행 중에는 모두에게 알리는 소식·전투 결과에서 멈추지 않는다
    const pause = ui.pause.bind(ui);
    ui.pause = (text?: string) => (this.autoUntil !== null ? Promise.resolve() : pause(text));
    // 매달 초 refresh()에서 자동 진행 종료를 확인한다
    const refresh = ui.refresh.bind(ui);
    ui.refresh = (focus?: number) => {
      this.onRefresh();
      refresh(focus);
    };

    const btn = (label: string, fn: () => void | Promise<void>) => {
      const b = el("button", { type: "button", textContent: label });
      b.addEventListener("click", () => void this.run(fn));
      return b;
    };
    const speed = select([["1", "보통"], ["0.25", "빠르게"], ["0", "즉시"]], "1");
    speed.addEventListener("change", () => (this.speed = Number(speed.value)));
    this.months = select([["1", "1"], ["6", "6"], ["12", "12"], ["60", "60"]], "12");
    this.autoBtn = btn("시작", () => this.toggleAuto());
    this.status = el("span", { className: "dbg-status" });
    this.out = el("pre", { className: "dbg-out" });
    const fold = el("button", { type: "button", textContent: "–", title: "접기" });
    fold.addEventListener("click", () => this.root.classList.toggle("folded"));

    this.root = el("aside", { className: "debug-panel" },
      el("header", {}, el("b", { textContent: "디버그" }), this.status, fold),
      el("div", { className: "dbg-body" },
        el("div", { className: "dbg-row" },
          btn("금·군량 가득", () => this.fillStock()), btn("병사·훈련 가득", () => this.fillArmy()), btn("재야 공개", () => this.reveal())),
        el("div", { className: "dbg-row" }, el("label", {}, "자동 진행 ", this.months, " 개월"), this.autoBtn),
        el("div", { className: "dbg-row" }, el("label", {}, "전투 속도 ", speed), btn("불변식 검사", () => this.check())),
        el("div", { className: "dbg-row" }, btn("상태 복사", () => this.exportState()), btn("상태 붙여넣기", () => this.importState())),
        this.out,
      ),
    );
    // 패널 안에서 누른 키가 게임 입력으로 새지 않게 한다
    this.root.addEventListener("keydown", (e) => e.stopPropagation());
    document.body.append(this.root);
    (window as unknown as { __debug: DebugPanel }).__debug = this;
  }

  attach(s: GameState) {
    this.s = s;
    this.update();
  }

  // 주소의 scenario 매개변수로 바로 시작할 게임. 처음 한 번만 쓴다.
  quickStart(): GameState | null {
    const sc = Number(params.get("scenario"));
    if (!SCENARIOS.some((x) => x.id === sc)) return null;
    params.delete("scenario");
    const players = (params.get("play") ?? "").split(",").filter((f): f is FactionId => FACTION_IDS.includes(f as FactionId));
    const diff = Math.min(3, Math.max(1, Number(params.get("diff") ?? 2))) as 1 | 2 | 3;
    const mode: Mode = params.get("mode") === "fiction" ? "fiction" : "history";
    return createGame(sc, players, mode, diff, params.get("watch") === "1" || players.length === 0);
  }

  dump(): string {
    return JSON.stringify(this.s);
  }

  private async run(fn: () => void | Promise<void>) {
    if (!this.s) return this.print(["게임이 시작된 뒤에 쓸 수 있습니다."]);
    await fn();
    this.ui.refresh();
  }

  private onRefresh() {
    const s = this.s;
    if (s && this.autoUntil !== null && s.year * 12 + s.month >= this.autoUntil) this.stopAuto();
    this.update();
  }

  private update() {
    const s = this.s;
    const seed = this.seed !== null ? ` · 시드 ${this.seed}` : "";
    const auto = this.autoUntil !== null ? " · 자동 진행 중" : "";
    this.status.textContent = s ? ` ${s.year}.${s.month}${seed}${auto}` : seed;
  }

  private print(lines: string[]) {
    this.out.textContent = lines.join("\n");
  }

  // 자동 진행 중에는 플레이어 표시를 잠시 꺼 두므로 그것까지 포함한다
  private mine(): FactionId[] {
    const s = this.s!;
    return FACTION_IDS.filter((f) => s.factions[f].player || this.autoPlayers.includes(f));
  }

  private fillStock() {
    const s = this.s!;
    const mine = this.mine();
    for (const r of s.regions) {
      if (!r.owner || !mine.includes(r.owner)) continue;
      r.gold = MAX_GOLD;
      r.food = MAX_FOOD;
    }
    this.print([`${names(s, mine)}: 모든 지역의 금·군량을 한도까지 채웠습니다.`]);
  }

  private fillArmy() {
    const s = this.s!;
    const mine = this.mine();
    for (const o of Object.values(s.officers)) {
      if (!o.alive || !o.faction || !mine.includes(o.faction)) continue;
      o.men = menCap(o);
      o.trn = 100;
      o.arm = 100;
      o.loy = Math.max(o.loy, 90);
    }
    this.print([`${names(s, mine)}: 장수의 병사·훈련·무장을 가득 채웠습니다.`]);
  }

  private reveal() {
    const free = Object.values(this.s!.officers).filter((o) => o.alive && !o.faction && o.hidden);
    for (const o of free) o.hidden = false;
    this.print([`숨은 재야 인재 ${free.length}명을 공개했습니다.`]);
  }

  private toggleAuto() {
    if (this.autoUntil !== null) return this.stopAuto();
    const s = this.s!;
    const n = Number(this.months.value);
    this.autoPlayers = FACTION_IDS.filter((f) => s.factions[f].player);
    for (const f of this.autoPlayers) s.factions[f].player = false;
    this.autoUntil = s.year * 12 + s.month + n;
    this.autoBtn.textContent = "멈춤";
    this.print([`${n}개월 동안 AI가 대신 진행합니다.`, "지금 입력 중인 명령을 마치면(0 휴식) 시작됩니다."]);
  }

  private stopAuto() {
    const s = this.s!;
    for (const f of this.autoPlayers) s.factions[f].player = true;
    this.autoPlayers = [];
    this.autoUntil = null;
    this.autoBtn.textContent = "시작";
    this.print([`자동 진행을 마쳤습니다 (${s.year}년 ${s.month}월).`, ...summary(s)]);
  }

  private check() {
    const s = this.s!;
    const v = checkInvariants(s);
    this.print(v.length ? [`불변식 위반 ${v.length}건:`, ...v.slice(0, 30)] : ["✅ 불변식 위반 없음", ...summary(s)]);
  }

  private async exportState() {
    const json = this.dump();
    try {
      await navigator.clipboard.writeText(json);
      this.print([`상태를 클립보드에 복사했습니다 (${Math.round(json.length / 1024)}KB).`]);
    } catch {
      this.print(["클립보드를 쓸 수 없습니다. 콘솔에서 __debug.dump() 결과를 복사하십시오."]);
    }
  }

  private importState() {
    const raw = window.prompt("붙여 넣을 상태 JSON");
    if (!raw) return;
    try {
      const next = JSON.parse(raw) as GameState;
      if (next.version !== 1 || !Array.isArray(next.regions)) throw new Error("형식이 다릅니다");
      Object.assign(this.s!, next, { queue: [] }); // 진행 중인 Game이 같은 객체를 보고 있으므로 내용만 바꾼다
      this.print([`${next.year}년 ${next.month}월 상태를 불러왔습니다. 지금 명령을 마치면 다음 달부터 적용됩니다.`]);
    } catch (e) {
      this.print([`불러오지 못했습니다: ${(e as Error).message}`]);
    }
  }
}

function names(s: GameState, fs: FactionId[]): string {
  return fs.map((f) => s.factions[f].name).join("·") || "플레이어 없음";
}

function summary(s: GameState): string[] {
  return FACTION_IDS.filter((f) => s.factions[f].alive).map((f) => {
    const regions = s.regions.filter((r) => r.owner === f).length;
    const offs = Object.values(s.officers).filter((o) => o.alive && o.faction === f);
    return `${s.factions[f].name}: ${regions}지역 · 장수 ${offs.length} · 병사 ${offs.reduce((a, o) => a + o.men, 0)}`;
  });
}
