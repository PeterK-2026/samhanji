// 생성 이미지 경로 (public/img/, scripts/optimize-images.py 가 만든다)
const base = import.meta.env.BASE_URL;
export const officerImg = (id: string) => `${base}img/officers/${id}.webp`;
export const regionImg = (id: number) => `${base}img/regions/${id}.webp`;
export const strategicMapImg = `${base}img/map/strategic.webp`;
export const battleTexImg = (name: string) => `${base}img/battle/${name}.webp`;
export const castleImg = `${base}img/battle/castle.webp`;
export const battlefieldImg = (regionId: number) => `${base}img/battlefields/${regionId}.webp`;
export const troopImg = (faction: string) => `${base}img/battle/troop-${faction}.webp`;
