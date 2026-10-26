// 재현 가능한 테스트를 위한 시드 난수. 엔진은 Math.random을 직접 쓰므로 통째로 바꿔 끼운다.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Math.random을 시드 난수로 바꾸고, 원래대로 돌려놓는 함수를 돌려준다.
export function seedRandom(seed: number): () => void {
  const orig = Math.random;
  Math.random = mulberry32(seed);
  return () => {
    Math.random = orig;
  };
}
