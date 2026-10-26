// "신라이(가)" 같은 표기를 앞 글자의 받침에 맞춰 "신라가"로 바꾼다.
const DIGIT_JONG = [true, true, false, true, false, false, true, true, true, false]; // 영일이삼사오육칠팔구
const DIGIT_RIEUL = [false, true, false, false, false, false, false, true, true, false]; // 일·칠·팔

function tail(ch: string): { jong: boolean; rieul: boolean } | null {
  const c = ch.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) {
    const j = (c - 0xac00) % 28;
    return { jong: j !== 0, rieul: j === 8 };
  }
  if (ch >= "0" && ch <= "9") return { jong: DIGIT_JONG[+ch], rieul: DIGIT_RIEUL[+ch] };
  return null;
}

const PAIRS: Record<string, [string, string]> = {
  "이(가)": ["이", "가"],
  "을(를)": ["을", "를"],
  "은(는)": ["은", "는"],
  "과(와)": ["과", "와"],
  "이다(다)": ["이다", "다"],
};

export function josa(text: string): string {
  return text.replace(/([가-힣0-9])\)?(이\(가\)|을\(를\)|은\(는\)|과\(와\)|\(으\)로)/g, (m, prev: string, pat: string) => {
    const t = tail(prev);
    const keep = m.slice(0, m.length - pat.length);
    if (!t) return m;
    if (pat === "(으)로") return keep + (t.jong && !t.rieul ? "으로" : "로");
    const [a, b] = PAIRS[pat];
    return keep + (t.jong ? a : b);
  });
}
