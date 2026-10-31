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
// 비율의 95% 신뢰구간 폭 (판 수가 적으면 커진다)
const moe = (p: number, n: number) => (n ? `±${Math.round(1.96 * Math.sqrt((Math.max(p * (1 - p), 0.25 / n)) / n) * 100)}` : "");

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
  warsPerYear: number;
  capturesPerYear: number;
  recaptureShare: number; // 점령 중 12개월 안의 탈환 비율
  atkWinRate: number; // 승부가 난 전투 중 공격측 승리 비율
  avgBattleMonths: number;
  noWarYears: number; // 출병이 한 번도 없었던 해의 비율
  fruitlessYears: number; // 출병은 있었으나 점령이 없었던 해의 비율
  netChangePerYear: number; // 1년 사이 주인이 달라진 지역 수
  extinct: number; // 모든 세력이 사라진 판 수
  falls: Partial<Record<FactionId, { conquest: number; heirless: number }>>;
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
  const falls: Summary["falls"] = {};
  for (const f of present) {
    falls[f] = {
      conquest: done.filter((r) => r.falls[f] === "conquest").length,
      heirless: done.filter((r) => r.falls[f] === "heirless").length,
    };
  }
  // 승부가 났거나 모든 세력이 사라진 뒤의 해는 뺀다
  const years = done.flatMap((r) => r.years.filter((y) => y.year < (r.winYear ?? r.extinctYear ?? Infinity)));
  const nYears = years.length || 1;
  const sum = (pick: (r: RunResult) => number) => done.reduce((a, r) => a + pick(r), 0);
  const captures = sum((r) => r.captures);
  const battles = sum((r) => r.battles);
  const s: Summary = {
    scenario: sc.id, title: sc.title, year: sc.year, runs: rs.length,
    errors: rs.filter((r) => r.error).length,
    violations: rs.filter((r) => r.violations.length).length,
    unified: done.filter((r) => r.winner).length,
    winners,
    medianWinYears: median(done.filter((r) => r.winYear).map((r) => r.winYear! - r.startYear)),
    survival, avgRegions,
    warsPerYear: years.reduce((a, y) => a + y.wars, 0) / nYears,
    capturesPerYear: years.reduce((a, y) => a + y.captures, 0) / nYears,
    recaptureShare: captures ? sum((r) => r.recaptures) / captures : 0,
    atkWinRate: battles ? sum((r) => r.atkWins) / battles : 0,
    avgBattleMonths: battles ? sum((r) => r.battleMonths) / battles : 0,
    noWarYears: years.filter((y) => !y.wars).length / nYears,
    fruitlessYears: years.filter((y) => y.wars && !y.captures).length / nYears,
    netChangePerYear: years.reduce((a, y) => a + y.changed, 0) / nYears,
    extinct: done.filter((r) => r.extinctYear !== null).length,
    falls,
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
  if (s.noWarYears > 0.3) w.push(`⚠️ 출병이 없는 해가 ${pct(s.noWarYears, 1)} — 전쟁이 드묾`);
  if (s.fruitlessYears > 0.3) w.push(`⚠️ 출병해도 점령이 없는 해가 ${pct(s.fruitlessYears, 1)} — 공격이 성과를 못 냄`);
  if (s.extinct) w.push(`⚠️ 모든 세력이 사라진 판 ${s.extinct}개 — 후반에 인물이 바닥남`);
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
  L.push("| 시나리오 | 통일 | 통일 세력 | 통일까지(중앙값) | 전멸 판 | 오류 | 위반 |");
  L.push("|---|---|---|---|---|---|---|");
  for (const s of sums) {
    const win = Object.entries(s.winners).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${name(f as FactionId)} ${n}`).join(", ") || "-";
    const n = s.runs - s.errors;
    L.push(`| ${s.scenario}. ${s.title} (${s.year}) | ${pct(s.unified, n)} ${moe(s.unified / (n || 1), n)} | ${win} | ${f1(s.medianWinYears)}년 | ${s.extinct} | ${s.errors} | ${s.violations} |`);
  }
  L.push("");
  L.push("### 전쟁 지표", "");
  L.push("| 시나리오 | 연간 출병 | 연간 점령 | 탈환 비율 | 공격 승률 | 전투 기간 | 연간 순변화 | 무전쟁 해 | 무소득 해 |");
  L.push("|---|---|---|---|---|---|---|---|---|");
  for (const s of sums) {
    L.push(`| ${s.scenario}. ${s.title} | ${f1(s.warsPerYear)} | ${f1(s.capturesPerYear)} | ${pct(s.recaptureShare, 1)} | ${pct(s.atkWinRate, 1)} | ${f1(s.avgBattleMonths)}개월 | ${f1(s.netChangePerYear)}곳 | ${pct(s.noWarYears, 1)} | ${pct(s.fruitlessYears, 1)} |`);
  }
  L.push("");
  for (const [i, s] of sums.entries()) {
    L.push(`## ${s.scenario}. ${s.title} (${s.year}년)`, "");
    L.push(s.warnings.length ? s.warnings.map((w) => `- ${w}`).join("\n") : "- ✅ 기준선 안에 있음");
    L.push("");
    L.push("| 세력 | 생존율 | 평균 최종 지역 | 통일 | 정복당함 | 후계 끊김 |");
    L.push("|---|---|---|---|---|---|");
    for (const f of Object.keys(s.survival) as FactionId[]) {
      const n = s.runs - s.errors;
      L.push(`| ${name(f)} | ${pct(s.survival[f]!, 1)} ${moe(s.survival[f]!, n)} | ${f1(s.avgRegions[f]!)} | ${s.winners[f] ?? 0} | ${s.falls[f]?.conquest ?? 0} | ${s.falls[f]?.heirless ?? 0} |`);
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
  L.push("- **±**: 비율의 95% 신뢰구간 폭(퍼센트포인트). 두 보고서의 차이가 이보다 작으면 우연일 수 있다.");
  L.push("- **전멸 판**: 모든 세력이 사라진 판 수. 아래 연간 지표는 승부가 났거나 전멸한 뒤의 해를 뺀다.");
  L.push("- **연간 출병·점령**: 사건을 직접 센 값. 같은 달의 재점령도 빠지지 않는다.");
  L.push("- **탈환 비율**: 점령 중 12개월 안에 빼앗겼던 땅을 되찾은 비율. 높으면 뺏고 뺏기는 소모전이다.");
  L.push("- **공격 승률·전투 기간**: 승부가 난 전투 기준. 흐지부지 끝난 공방전은 뺀다.");
  L.push("- **연간 순변화**: 연초와 연말의 주인이 다른 지역 수. 연간 점령보다 많이 작으면 제자리걸음이다.");
  L.push("- **무전쟁 해**: 출병이 한 번도 없었던 해. **무소득 해**: 출병은 있었으나 점령이 없었던 해.");
  L.push("- **정복당함·후계 끊김**: 멸망 원인. 후계 끊김은 영토가 남아 있어도 이을 장수가 없어 망한 경우다.");
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
