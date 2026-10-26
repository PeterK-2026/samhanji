"""인물·도시 이미지 생성용 프롬프트 목록(assets-src/manifest.json)을 만든다.

사용법: python scripts/image-manifest.py
officers.ts 를 읽어 인물별 프롬프트를, 아래 REGIONS 표로 도시별 프롬프트를 만든다.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PORTRAIT_STYLE = (
    "Style (must stay consistent across the whole series): square 1:1 bust portrait, head and shoulders, "
    "3/4 view, painted semi-realistic gouache illustration like a classic 1990s historical strategy-game "
    "character portrait, warm muted palette, soft rim light, plain dark ink-wash background, "
    "no text, no frame, no watermark."
)
CITY_STYLE = (
    "Style (must stay consistent across the whole series): landscape 3:2 painted semi-realistic gouache "
    "illustration like a classic historical strategy-game city screen, elevated three-quarter bird's-eye view, "
    "warm muted palette, no people in close-up, no text, no frame, no watermark."
)

FACTION_LOOK = {
    "silla": "7th-century Silla (Korea) attire with gold ornaments and red-and-gold accents",
    "baekje": "7th-century Baekje (Korea) attire with indigo-blue and silver accents",
    "goguryeo": "7th-century Goguryeo (Korea) attire with crimson and black, bird-feather cap ornaments (jougwan) where fitting",
    "tang": "7th-century Tang dynasty (China) attire with purple and gold accents",
}
FACTION_EN = {"silla": "Silla", "baekje": "Baekje", "goguryeo": "Goguryeo", "tang": "Tang China"}

FEMALE = {"seondeok", "jindeok"}
MONK = {"dochim", "sinseong", "wonhyo", "uisang", "jajang", "boduk"}
SCHOLAR = {"gangsu", "seolchong", "deugo", "f_sil_6", "f_bae_6", "f_gog_7", "liyifu"}
YOUTH = {"gwanchang", "jangchun", "parang", "geojin"}
KINGS = {"seondeok", "jindeok", "chunchu", "beopmin", "uija", "yeongnyu", "bojang", "taizong", "gaozong", "anseung", "pung"}
# 출신이 다른 당나라 장수
ETHNIC = {
    "saenghae": "a Mohe (Malgal) warrior chieftain allied with Goguryeo, fur-trimmed armor",
    "heonseong": "a Goguryeo nobleman, son of Yeon Namsaeng",
    "ashina": "a Göktürk (Turkic) nobleman serving Tang, braided hair, steppe features",
    "qibi": "a Tiele steppe nobleman serving Tang",
    "ligeunhaeng": "a Mohe (Malgal) chieftain serving Tang, fur-trimmed armor",
    "seolgyedu": "a Silla-born man serving in the Tang army",
}
EXTRA = {
    "gaesomun": "fierce commanding presence, carrying five swords as legend says",
    "manchun": "calm defender of Ansi fortress, determined eyes",
    "gyebaek": "grim resolve before his last battle",
    "gwanchang": "a teenage hwarang youth, brave and earnest",
    "xuerengui": "famous for fighting in white robes over armor",
    "seondeok": "first queen regnant of Silla, wise and serene, golden crown with jade ornaments",
    "jindeok": "queen of Silla, graceful, golden crown",
    "taizong": "emperor Taizong of Tang, imperial yellow robes and crown",
    "gaozong": "emperor Gaozong of Tang, imperial robes and crown",
    "gangsu": "Confucian scholar-official holding a scroll",
}


def parse_officers():
    src = "".join((ROOT / f).read_text(encoding="utf-8") for f in ("src/data/officers.ts", "src/data/officers-extra.ts"))
    # officers.ts 의 o(...) 와 officers-extra.ts 의 x(...) 를 모두 읽는다
    pat = re.compile(r'[ox]\("(\w+)", "([^"]+)", (\d+), (\d+), (\d+), (\d+), (\d+), "(\w+)", "([^"]*)"')
    return [
        dict(id=m[0], name=m[1], born=int(m[2]), died=int(m[3]), int=int(m[4]), war=int(m[5]), chr=int(m[6]), home=m[7], note=m[8].removeprefix("[가상]").strip())
        for m in pat.findall(src)
    ]


def officer_prompt(o):
    age = max(18, min(70, 655 - o["born"]))
    if o["id"] in YOUTH:
        age = min(age, 17)
    gender = "woman" if o["id"] in FEMALE else "man"
    if o["id"] in MONK:
        role = "a Buddhist monk with shaved head in grey-brown monastic robes"
    elif o["id"] in KINGS:
        role = "a monarch in royal robes and crown"
    elif o["id"] in SCHOLAR:
        role = "a scholar-official / strategist in court robes and official hat"
    elif o["war"] >= 75:
        role = "a battle-hardened general in lamellar armor and helmet"
    elif o["int"] >= 82:
        role = "a scholar-official / strategist in court robes and official hat"
    else:
        role = "a military officer in light armor"
    who = ETHNIC.get(o["id"], f"a {FACTION_EN[o['home']]} {gender}")
    extra = EXTRA.get(o["id"], "")
    return (
        f"Subject: {o['name']}, {who}, about {age} years old, {role}. "
        f"Historical note: {o['note']}. {FACTION_LOOK[o['home']]}. {extra}\n{PORTRAIT_STYLE}"
    )


REGIONS = {
    1: ("부여성", "Buyeo fortress of Goguryeo on the northern Manchurian plains, earthen and stone walls, grasslands"),
    2: ("신성", "Sinseong 'New Fortress' of Goguryeo, stone mountain fortress guarding the Liao river frontier"),
    3: ("요동성", "Yodong (Liaodong) fortress of Goguryeo, great stone-walled city on the Liao plain with watchtowers"),
    4: ("안시성", "Ansi fortress of Goguryeo, mountain fortress on a ridge with zig-zag stone walls, Tang siege mound nearby"),
    5: ("비사성", "Bisa fortress of Goguryeo on a seaside cliff at the tip of the Liaodong peninsula, sea below"),
    6: ("오골성", "Ogol fortress of Goguryeo, rugged stone mountain fortress among forested peaks"),
    7: ("국내성", "Gungnae city, old Goguryeo capital by the Yalu river, square stone walls, stepped stone tombs nearby"),
    8: ("책성", "Chaekseong fortress of Goguryeo in the northeastern frontier, wooden palisade and stone walls, pine forests"),
    9: ("평양성", "Pyongyang city, capital of Goguryeo, vast walled city along the Taedong river with inner and outer walls"),
    10: ("수곡성", "Sugok fortress of Goguryeo, hill fortress overlooking valleys"),
    11: ("비열홀", "Biyeolhol, coastal fortress town on the east sea of Korea"),
    12: ("한산주", "Hansanju, Silla provincial seat by the Han river, earthen fortress on a hill above the river"),
    13: ("당항성", "Danghang fortress, Silla port fortress on the west sea coast with ships to Tang"),
    14: ("우수주", "Usuju, Silla mountain town in Gangwon highlands by a river"),
    15: ("하슬라", "Haseulla (Gangneung), Silla coastal town between mountains and the east sea"),
    16: ("국원", "Gugwon (Chungju), Silla secondary capital by the Namhan river, central stone pagoda"),
    17: ("상주", "Sangju, Silla provincial seat among rice plains and mountains"),
    18: ("금성", "Geumseong (Gyeongju), royal capital of Silla: palace halls, wooden pagoda of Hwangnyongsa, walls and gates"),
    19: ("대야성", "Daeya fortress (Hapcheon), Silla frontier stone fortress on a mountain against Baekje"),
    20: ("금관", "Geumgwan (Gimhae), former Gaya capital, port town by the river mouth, iron workshops"),
    21: ("임존성", "Imjon fortress, Baekje stone mountain fortress among hills, later center of the restoration army"),
    22: ("웅진", "Ungjin (Gongju), Baekje secondary capital, Gongsanseong fortress above the Geum river"),
    23: ("사비", "Sabi (Buyeo), royal capital of Baekje on the Geum river, Busosan fortress, elegant palaces and a stone pagoda"),
    24: ("익산", "Iksan, Baekje royal city with the great Mireuksa temple and its stone pagoda"),
    25: ("남원", "Namwon, Baekje town in a mountain basin with walls"),
    26: ("무진주", "Mujinju (Gwangju), Baekje southern provincial town in fertile plains below Mudeungsan"),
    27: ("영주", "Yingzhou, Tang frontier garrison city in the northeast steppe edge, Tang-style walls and gate towers"),
    28: ("유주", "Youzhou (near Beijing), Tang military hub, massive rammed-earth walls and army camps"),
    29: ("등주", "Dengzhou, Tang port city on the Shandong coast, war fleet harbor"),
    30: ("기주", "Jizhou, Tang prefectural city on the Hebei plain"),
    31: ("낙양", "Luoyang, eastern capital of Tang, grand palace and city gates by the Luo river"),
    32: ("장안", "Chang'an, capital of Tang, enormous gridded city with the Daming palace and great walls"),
}


def main():
    items = []
    for o in parse_officers():
        items.append({"file": f"assets-src/officers/{o['id']}.png", "prompt": officer_prompt(o)})
    for rid, (name, desc) in REGIONS.items():
        items.append({"file": f"assets-src/regions/{rid}.png", "prompt": f"Subject: {name} — {desc}, 7th century.\n{CITY_STYLE}"})
    out = ROOT / "assets-src/manifest.json"
    out.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(items)} items -> {out}")


if __name__ == "__main__":
    main()
