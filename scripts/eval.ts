// 밸런스 평가: 시나리오마다 시드를 바꿔 AI끼리 여러 판 돌리고 결과를 보고서로 남긴다.
// 사용법: npm run eval -- [판 수=20] [연수=40] [시나리오=1,2,3,4]
// 결과: reports/eval-latest.md (사람이 읽는 보고서), reports/eval-latest.json (원자료)
import { mkdirSync, writeFileSync } from "node:fs";
import { runHeadless, type RunResult } from "../src/dev/headless";
import { FACTION_INFO, SCENARIOS } from "../src/data/scenarios";
import { FACTION_IDS, type FactionId } from "../src/engine/types";
import { josa } from "../src/ui/josa";

const runs = Number(process.argv[2] ?? 20);
const years = Number(process.argv[3] ?? 40);
const only = (process.argv[4] ?? "1,2,3,4").split(",").map(Number);

const name = (f: FactionId) => FACTION_INFO[f].name;
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "-");
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const a = [...xs].sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
const f1 = (n: number) => (Number.isNaN(n) ? "-" : n.toFixed(1));

interface Summary {
  scenario: number;
  title: string;
  year: number;
  runs: number;
  errors: number;
  violations: number;
  unified: number;
  winners: Partial<Record<FactionId, number>>;
  medianWinYears: number; // 통일까지 걸린 햇수 (중앙값)
  survival: Partial<Record<FactionId, number>>; // 끝까지 살아남은 비율
  avgRegions: Partial<Record<FactionId, number>>;
  capturesPerYear: number;
  quietYears: number; // 점령이 한 번도 없었던 해의 비율
  msPerYear: number;
  warnings: string[];
}

function summarize(sc: (typeof SCENARIOS)[number], rs: RunResult[]): Summary {
  const present = FACTION_IDS.filter((f) => sc.rulers[f]);
  const done = rs.filter((r) => !r.error);
  const winners: Summary["winners"] = {};
  for (const r of done) if (r.winner) winners[r.winner] = (winners[r.winner] ?? 0) + 1;
  const survival: Summary["survival"] = {};
  const avgRegions: Summary["avgRegions"] = {};
  for (const f of present) {
    survival[f] = done.filter((r) => r.final[f].alive).length / (done.length || 1);
    avgRegions[f] = avg(done.map((r) => r.final[f].regions));
  }
  // 연초 기록 사이 영토 변화가 없었던 해
  let quiet = 0;
  let spans = 0;
  for (const r of done) {
    for (let i = 1; i < r.history.length; i++) {
      if (r.winner && r.history[i].year > (r.winYear ?? 0)) break;
      spans++;
      if (FACTION_IDS.every((f) => r.history[i].regions[f] === r.history[i - 1].regions[f])) quiet++;
    }
  }
  const played = done.reduce((a, r) => a + r.months / 12, 0);
  const s: Summary = {
    scenario: sc.id, title: sc.title, year: sc.year, runs: rs.length,
    errors: rs.filter((r) => r.error).length,
    violations: rs.filter((r) => r.violations.length).length,
    unified: done.filter((r) => r.winner).length,
    winners,
    medianWinYears: median(done.filter((r) => r.winYear).map((r) => r.winYear! - r.startYear)),
    survival, avgRegions,
    capturesPerYear: done.reduce((a, r) => a + r.captures, 0) / (played || 1),
    quietYears: spans ? quiet / spans : 0,
    msPerYear: rs.reduce((a, r) => a + r.ms, 0) / (rs.reduce((a, r) => a + r.months / 12, 0) || 1),
    warnings: [],
  };
  // 평가 기준. 수치는 경험적 기준선이며, 넘으면 확인해 볼 만하다는 뜻이다.
  const w = s.warnings;
  if (s.errors) w.push(`❌ 런타임 오류 ${s.errors}판`);
  if (s.violations) w.push(`❌ 불변식 위반 ${s.violations}판`);
  const top = Object.entries(winners).sort((a, b) => b[1] - a[1])[0];
  if (top && done.length >= 5 && top[1] / done.length > 0.8) w.push(`⚠️ ${name(top[0] as FactionId)} 통일 ${pct(top[1], done.length)} — 한 세력이 지나치게 강함`);
  if (done.length >= 5 && s.unified / done.length < 0.1) w.push(`⚠️ ${years}년 안에 통일된 판이 ${pct(s.unified, done.length)} — 교착 상태가 잦음`);
  if (!Number.isNaN(s.medianWinYears) && s.medianWinYears < 8) w.push(`⚠️ 통일까지 중앙값 ${s.medianWinYears}년 — 너무 빨리 끝남`);
  if (s.quietYears > 0.5) w.push(`⚠️ 영토 변화가 없는 해가 ${pct(s.quietYears, 1)} — 전쟁이 드묾`);
  for (const f of present) {
    if ((survival[f] ?? 0) === 0 && done.length >= 5) w.push(`⚠️ ${name(f)}이(가) 한 판도 살아남지 못함`);
  }
  return s;
}

function markdown(sums: Summary[], all: RunResult[][]): string {
  const L: string[] = [];
  L.push(`# 삼한지 밸런스 평가`, "");
  L.push(`- 생성: ${new Date().toLocaleString("ko-KR")}`);
  L.push(`- 조건: 시나리오마다 ${runs}판 × 최대 ${years}년, AI끼리, 난이도 중급, 역사 모드, 시드 1~${runs}`);
  L.push(`- 재현: \`npm run eval -- ${runs} ${years} ${only.join(",")}\` (같은 시드면 같은 결과)`, "");
  L.push("## 요약", "");
  L.push("| 시나리오 | 통일 | 통일 세력 | 통일까지(중앙값) | 연간 점령 | 교착 해 | 오류 | 위반 |");
  L.push("|---|---|---|---|---|---|---|---|");
  for (const s of sums) {
    const win = Object.entries(s.winners).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${name(f as FactionId)} ${n}`).join(", ") || "-";
    L.push(`| ${s.scenario}. ${s.title} (${s.year}) | ${pct(s.unified, s.runs - s.errors)} | ${win} | ${f1(s.medianWinYears)}년 | ${f1(s.capturesPerYear)} | ${pct(s.quietYears, 1)} | ${s.errors} | ${s.violations} |`);
  }
  L.push("");
  for (const [i, s] of sums.entries()) {
    L.push(`## ${s.scenario}. ${s.title} (${s.year}년)`, "");
    L.push(s.warnings.length ? s.warnings.map((w) => `- ${w}`).join("\n") : "- ✅ 기준선 안에 있음");
    L.push("");
    L.push("| 세력 | 생존율 | 평균 최종 지역 | 통일 |");
    L.push("|---|---|---|---|");
    for (const f of Object.keys(s.survival) as FactionId[]) {
      L.push(`| ${name(f)} | ${pct(s.survival[f]!, 1)} | ${f1(s.avgRegions[f]!)} | ${s.winners[f] ?? 0} |`);
    }
    L.push("");
    const bad = all[i].filter((r) => r.error || r.violations.length);
    for (const r of bad.slice(0, 5)) {
      L.push(`<details><summary>시드 ${r.seed}: ${r.error ? "오류" : `위반 ${r.violations.length}건`}</summary>`, "", "```");
      L.push(...(r.error ? [r.error.split("\n").slice(0, 8).join("\n")] : r.violations.slice(0, 15)));
      L.push("```", "</details>", "");
    }
    L.push(`<details><summary>판별 결과</summary>`, "");
    L.push("| 시드 | 결과 | 종료 | 점령 | 멸망 |");
    L.push("|---|---|---|---|---|");
    for (const r of all[i]) {
      const res = r.error ? "오류" : r.winner ? `${name(r.winner)} 통일` : "미결";
      const fall = Object.entries(r.destroyed).map(([f, y]) => `${name(f as FactionId)} ${y}`).join(", ") || "-";
      L.push(`| ${r.seed} | ${res} | ${r.endYear}.${r.endMonth} | ${r.captures} | ${fall} |`);
    }
    L.push("", "</details>", "");
  }
  L.push("## 읽는 법", "");
  L.push("- **통일**: 한반도·요동 지역(korea 표시)을 한 세력이 모두 차지한 판의 비율.");
  L.push("- **연간 점령**: 1년에 지역 주인이 바뀐 평균 횟수. 전쟁이 얼마나 활발한지 보여 준다.");
  L.push("- **교착 해**: 연초 기준으로 영토 변화가 전혀 없었던 해의 비율 (통일 이후는 뺌).");
  L.push("- **위반**: `src/dev/check.ts`의 상태 불변식(장수 위치, 자원 한도, 군주 상태 등)을 어긴 판 수. 0이어야 한다.");
  return L.join("\n") + "\n";
}

const sums: Summary[] = [];
const all: RunResult[][] = [];
for (const sc of SCENARIOS.filter((x) => only.includes(x.id))) {
  const rs: RunResult[] = [];
  for (let seed = 1; seed <= runs; seed++) {
    const r = await runHeadless({ scenario: sc.id, years, seed });
    rs.push(r);
    const tag = r.error ? "ERR" : r.winner ? `${r.winner}@${r.winYear}` : "-";
    if (process.stdout.isTTY) process.stdout.write(`\rscenario ${sc.id}: ${seed}/${runs} ${tag.padEnd(16)}`);
  }
  console.log(`scenario ${sc.id}: ${runs}판 완료`);
  const s = summarize(sc, rs);
  sums.push(s);
  all.push(rs);
  for (const w of s.warnings) console.log("  " + josa(w));
}

mkdirSync("reports", { recursive: true });
writeFileSync("reports/eval-latest.md", josa(markdown(sums, all)));
writeFileSync("reports/eval-latest.json", JSON.stringify({ runs, years, summaries: sums, results: all.flat() }, null, 1));
console.log("-> reports/eval-latest.md, reports/eval-latest.json");
process.exit(sums.some((s) => s.errors || s.violations) ? 1 : 0);
