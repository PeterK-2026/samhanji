import type { GameState } from "./engine/types";

const KEY = (slot: number) => `samhanji.save.${slot}`;

export interface SaveInfo {
  slot: number;
  label: string;
}

export function listSaves(): SaveInfo[] {
  const out: SaveInfo[] = [];
  for (let slot = 1; slot <= 5; slot++) {
    let label = "(비어 있음)";
    try {
      const raw = localStorage.getItem(KEY(slot));
      if (raw) label = (JSON.parse(raw) as { label: string }).label;
    } catch {
      label = "(읽을 수 없음)";
    }
    out.push({ slot, label });
  }
  return out;
}

export function saveGame(slot: number, s: GameState): boolean {
  const players = Object.values(s.factions).filter((f) => f.player).map((f) => f.name).join("·");
  const label = `${s.year}년 ${s.month}월 ${players} — ${new Date().toLocaleString("ko-KR")}`;
  try {
    localStorage.setItem(KEY(slot), JSON.stringify({ label, state: s }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(slot: number): GameState | null {
  try {
    const raw = localStorage.getItem(KEY(slot));
    if (!raw) return null;
    const st = (JSON.parse(raw) as { state: GameState }).state;
    return st.version === 1 ? st : null;
  } catch {
    return null;
  }
}
