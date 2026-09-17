# Mac дээр Starshopping-ийг сэргээх — баталгаажсан заавар

Огноо: 2026-09-08. Энэ файл дахь бүх зүйлийг **шалгаж баталсан** (таамаглаагүй).

---

## 0. Хамгийн эхэнд мэдэх зүйл

**Сайтын код бүхэлдээ аюулгүй.** Хуучин notebook форматлагдсан ч алдагдсан
код байхгүй. Бүгд GitHub дээр байна:

| | |
|---|---|
| **Амьд сайт** | https://starshopping-mn.github.io |
| **Үндсэн repo** | `starshopping-mn/starshopping-mn.github.io` (нийтийн) |
| **Хуучин repo** | `ariunboldagency-commits/Starshopping` — зөвхөн redirect хуудас |
| **Сүүлд өөрчилсөн** | 2026-08-20 |

Repo-г 2026-09-08-нд бүрэн татаж шалгасан. Дотор нь:

- `index.html` (188 мөр), `script.js` (2 248 мөр), `style.css` (1 261 мөр)
- `apps-script/Code.gs` (850 мөр) — Google Apps Script backend
- `CLAUDE.md` (54 KB) — төслийн бүрэн гарын авлага
- `assets/`, `img/`, `og/`, `p/`, `vendor/gsap`, `tools/build-og.py`
- `.github/workflows/pages.yml` (deploy) ба `health.yml` (цаг тутмын шалгалт)

---

## 1. Mac дээр татах

```bash
cd ~/Documents
git clone https://github.com/starshopping-mn/starshopping-mn.github.io.git Starshopping-web
cd Starshopping-web
```

Хуучин repo-г мөн remote болгож нэмэх (сонголт):

```bash
git remote add oldsite https://github.com/ariunboldagency-commits/Starshopping.git
```

---

## 2. Суулгах хэрэгслүүд

```bash
# Homebrew байхгүй бол эхлээд:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install git gh ffmpeg python3
pip3 install Pillow rembg
```

| Хэрэгсэл | Юунд |
|---|---|
| `git` | код татах, түлхэх |
| `gh` | GitHub-д нэвтрэх, PR үүсгэх |
| `ffmpeg` | бичлэгээс кадр задлах (алдаа оношлоход) |
| `python3` + `Pillow` | `tools/build-og.py` — холбоосын карт |
| `rembg` | барааны зургийн дэвсгэр арилгах |

---

## 3. Дахин нэвтрэх бүртгэлүүд

Эдгээр нь **файл биш**, тиймээс форматлахад алдагдаагүй. Гэхдээ Mac дээр
дахин нэвтрэх шаардлагатай.

| Үйлчилгээ | Бүртгэл |
|---|---|
| GitHub (үндсэн) | `starshopping-mn` |
| GitHub (хуучин repo) | `ariunboldagency-commits` |
| Google — Sheet, Drive, Apps Script | `ariunbold.agency@gmail.com` |
| ElevenLabs | `ariunbold95505@gmail.com` (⚠️ ажлын хаягаас өөр) |
| Meta Ads Manager / Ad Library | Starshopping business portfolio |

GitHub-д хоёр бүртгэлээр нэвтрэх:

```bash
gh auth login          # эхлээд starshopping-mn
gh auth login          # дараа нь ariunboldagency-commits
gh auth switch -u starshopping-mn    # солихдоо
```

---

## 4. Локал дээр ажиллуулж шалгах

```bash
cd ~/Documents/Starshopping-web
python3 -m http.server 8000
```

Дараа нь хөтөч дээр `http://localhost:8000` нээнэ.
Утсан дээр хэмжихдээ хаягийн ард `?diag` нэмнэ (`CLAUDE.md` §6-г үз).

---

## 5. Drive дэх багц — repo-д БАЙХГҮЙ зүйлс

Хавтас: **Google Drive → `Starshopping-handover-2026-09-04`**
(бүртгэл: `ariunbold.agency@gmail.com`)

| Дотор нь | Юу вэ | Mac дээр хаана тавих |
|---|---|---|
| `Artifacts/` | `starshopping-ads-pin`, `starshopping-baraa-sudalgaa` — эх кодтой | хүссэн газраа |
| `Scheduled/` | 5 хуваарьт даалгаврын `SKILL.md` | `~/.claude/skills/` |
| `claude-memory/` | Claude-ийн санах ой + `settings.json` | `~/.claude/` |
| `Logo-эх-файл/` | Логоны 2000×2000 эх файл | хүссэн газраа |

`Scheduled/` дотор: `ads-shalgah`, `forms-shalgah`, `orsoldogch-shalgah`,
`hansh-shalgah`, `morning-brief`. Эдгээр нь бизнесийн тооцооны логиктой тул
хамгийн үнэ цэнэтэй хэсэг.

⚠️ `orsoldogch-shalgah` нь хуучин Windows машины `comp_state.json`-г уншдаг
байсан. Тэр зам Mac дээр байхгүй — даалгаврыг шинээр тохируулахдаа замыг нь
солино.

---

## 6. Claude-д хамгийн түрүүнд уншуулах

```
CLAUDE.md
```

Repo дотор байгаа. 54 KB, 15 бүлэг. Дотор нь:

- §2 архитектур
- §3 **эвдэж болохгүй зүйлс** (hero zoom, pin дараалал, гуравдагч сервер)
- §4 deploy дүрэм
- §5 Sheet-ийн бүтэц
- §6 хэрхэн шалгах
- §7 өмнө хийсэн алдаанууд
- §9 дараа хийх зүйлс

Хуучин ярианы түүхийг дахин ярих шаардлагагүй — бүх зүйл энд бий.
