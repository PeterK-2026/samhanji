import { listSaves, loadGame, saveGame } from "../save";
import { aiAct } from "./ai";
import { COMMANDS, runCommand, type Ctx } from "./commands";
import { monthStart } from "./economy";
import type { IO } from "./io";
import { playerAlive, regionLabel, victor } from "./politics";
import { officersIn, regionOf, seasonName, shuffle } from "./state";
import type { GameState } from "./types";

export type RunResult = { kind: "title" } | { kind: "load"; state: GameState };

export class Game {
  private pendingLoad: GameState | null = null;

  constructor(private io: IO, public s: GameState) {}

  async run(): Promise<RunResult> {
    const s = this.s;
    while (!s.over) {
      if (s.queue.length === 0) {
        this.io.clear();
        this.io.refresh();
        this.io.say(`━━ ${s.year}년 ${s.month}월 (${seasonName(s.month)}) ━━`);
        const news = monthStart(s).filter((n) => !n.to || s.factions[n.to].player);
        for (const n of news) this.io.say(n.text);
        this.io.refresh();
        if (await this.checkEnd()) break;
        if (news.length) await this.io.pause();
        await this.checkDelegation();
        s.queue = shuffle(s.regions.filter((r) => r.owner).map((r) => r.id));
      }

      while (s.queue.length) {
        const rid = s.queue[0];
        const r = regionOf(s, rid);
        if (r.owner && s.factions[r.owner].alive) {
          if (s.factions[r.owner].player && !r.delegated) {
            const res = await this.playerTurn(rid);
            if (res === "quit") {
              return this.pendingLoad ? { kind: "load", state: this.pendingLoad } : { kind: "title" };
            }
          } else {
            await aiAct(s, this.io, rid);
          }
          if (await this.checkEnd()) break;
        }
        s.queue.shift();
      }
      if (s.over) break;
      s.month++;
      if (s.month > 12) {
        s.month = 1;
        s.year++;
      }
    }
    return { kind: "title" };
  }

  private async checkEnd(): Promise<boolean> {
    const s = this.s;
    const v = victor(s);
    if (v) {
      s.over = true;
      this.io.clear();
      if (s.factions[v].player) {
        this.io.say(`🎉 ${s.factions[v].name}이(가) 삼한을 하나로 통일했습니다! (${s.year}년)`);
        this.io.say("천하가 그대의 이름을 기억할 것입니다.");
      } else {
        this.io.say(`${s.factions[v].name}이(가) 삼한을 통일했습니다. 그대의 꿈은 여기서 끝났습니다.`);
      }
      await this.io.pause("타이틀로 돌아갑니다");
      return true;
    }
    const hadPlayers = Object.values(s.factions).some((f) => f.player);
    if (hadPlayers && !playerAlive(s)) {
      s.over = true;
      this.io.clear();
      this.io.say("그대의 나라는 멸망했습니다… (GAME OVER)");
      await this.io.pause("타이틀로 돌아갑니다");
      return true;
    }
    return false;
  }

  private async checkDelegation() {
    const s = this.s;
    for (const f of Object.values(s.factions)) {
      if (!f.player || !f.alive) continue;
      const mine = s.regions.filter((r) => r.owner === f.id);
      if (mine.length && mine.every((r) => r.delegated)) {
        if (!(await this.io.confirm(`${f.name}: 모든 지역이 위임 중입니다. 계속 위임합니까?`))) {
          mine.forEach((r) => (r.delegated = false));
        }
      }
    }
  }

  private async playerTurn(rid: number): Promise<"done" | "quit"> {
    const s = this.s;
    const r = regionOf(s, rid);
    const f = r.owner!;
    const ctx: Ctx = { s, io: this.io, rid, f };
    this.io.clear();
    this.io.refresh(rid);
    const rulerId = s.factions[f].ruler;
    const ruler = rulerId ? s.officers[rulerId].name : s.factions[f].name;
    // 장수가 없는 지역은 명령을 내릴 수 없으므로 건너뛴다
    if (officersIn(s, rid).length === 0) return "done";
    for (;;) {
      this.io.refresh(rid);
      const no = await this.io.choose(
        `${ruler}님, ${regionLabel(s, rid)}의 명령은? (0~19)`,
        COMMANDS.map((c) => ({ value: c.no, label: c.name })),
        { columns: 4 },
      );
      if (no === null) continue;
      if (no === 0) return "done";
      this.io.clear();
      const res = await runCommand(ctx, no, (c) => this.other(c));
      if (res === "quit") return "quit";
      if (s.over) return "done";
      if (res === true) {
        this.io.refresh(rid);
        // 전쟁은 전투 화면에서 이미 한 번 멈췄다
        if (no !== 3) await this.io.pause();
        return "done";
      }
      // 소비하지 않는 명령: 결과를 보여 준 뒤 다시 명령 선택
    }
  }

  private async other(c: Ctx): Promise<"continue" | "quit"> {
    const sub = await this.io.choose("기타", [
      { value: 1, label: "저장" }, { value: 2, label: "불러오기" },
      { value: 3, label: `다른 세력 전투 보기: ${c.s.showOtherBattles ? "켬" : "끔"}` }, { value: 4, label: "타이틀로" },
    ], { cancel: true, columns: 2 });
    if (sub === 1 || sub === 2) {
      const saves = listSaves();
      const slot = await this.io.choose(sub === 1 ? "어느 칸에 저장합니까?" : "어느 칸을 불러옵니까?",
        saves.map((x) => ({ value: x.slot, label: `${x.slot}. ${x.label}` })), { cancel: true, columns: 1 });
      if (!slot) return "continue";
      if (sub === 1) {
        this.io.say(saveGame(slot, c.s) ? `${slot}번 칸에 저장했습니다.` : "저장하지 못했습니다. (브라우저 저장소를 쓸 수 없음)");
        return "continue";
      }
      const st = loadGame(slot);
      if (!st) {
        this.io.say("불러올 수 없습니다.");
        return "continue";
      }
      this.pendingLoad = st;
      return "quit";
    }
    if (sub === 3) {
      c.s.showOtherBattles = !c.s.showOtherBattles;
      this.io.say(`다른 세력 전투 보기: ${c.s.showOtherBattles ? "켬" : "끔"}`);
      return "continue";
    }
    if (sub === 4) {
      if (await this.io.confirm("저장하지 않은 진행은 사라집니다. 타이틀로 돌아갑니까?")) return "quit";
    }
    return "continue";
  }
}
