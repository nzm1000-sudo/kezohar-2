# כְּזֹהַר הָרָקִיעַ · דף התרומות

> קומפלקס רוחני-קהילתי בלב נתיבות · בנשיאות הרב שלום יוסף ברבי שליט״א · עולמות יחד

דף נחיתה סטטי לגיוס תרומות, מתארח ב־GitHub Pages. אין שלב build: כל הקבצים בריפו הם מה שהדפדפן מקבל.
הרעיון: בניין שנדלק חלון אחר חלון. "כל מטר מדליק אור." פירוט מלא של ההחלטות: [`DESIGN_NOTES.md`](DESIGN_NOTES.md).

## מבנה

```
index.html              הדף הראשי (כל התוכן החיוני ב־HTML, עובד גם בלי JS)
privacy.html            מדיניות פרטיות (טיוטה לאישור העמותה)
accessibility.html      הצהרת נגישות (טיוטה, חסר שם רכז/ת נגישות)
css/main.css            מערכת העיצוב: טוקנים, בהיר/כהה, כל הרכיבים
js/app.js               ניווט, מצב כהה, דיאלוג, קיר המטרים, נתונים חיים, טעינת 3D
js/scene.js             סצנת התלת־ממד (three.js), נטענת רק כשמתאים
js/theme-init.js        החלת מצב צבע לפני ציור (לעמודי המשנה)
vendor/                 three.js / GSAP + ScrollTrigger / Lenis כמודולי ES סטטיים (import map)
fonts/                  Heebo + Frank Ruhl Libre, subset עברי ולטיני, woff2
images/r/               תמונות AVIF + WebP בכמה רוחבים, poster של הבניין הדולק
images/qr-donate.svg    QR מקומי לדף התרומה
data/campaign.json      נתוני קמפיין חיים (ריקים כברירת מחדל)
scripts/                סקריפטים לפיתוח בלבד: בניית vendor ונכסים
docs/screenshots/       צילומי מסך 375/768/1440, בהיר/כהה, עם/בלי 3D, reduced motion
docs/reports/           דוח Lighthouse מובייל ודוח axe
backup-legacy/          גיבוי של האתר הקודם. לא לגעת.
```

## עדכון נתוני הקמפיין (ידני)

הדף לא מחובר לנדרים פלוס. כל מה שמוצג כ"חי" מגיע רק מהקובץ `data/campaign.json`:

```json
{ "goalMeters": null, "soldMeters": null, "donorCount": null, "recentDonors": [], "updatedAt": null }
```

| שדה | מה עושה | מתי מוצג |
| --- | --- | --- |
| `goalMeters` | יעד המטרים של הקמפיין (מספר) | פס ההתקדמות מופיע רק כש־`goalMeters` וגם `soldMeters` מלאים |
| `soldMeters` | כמה מטרים נתרמו בפועל (מספר) | גם קובע איזה חלק מחלונות הבניין דולק במצב הסופי |
| `donorCount` | מספר תורמים (מספר) | שמור לשימוש עתידי, לא מוצג כרגע |
| `recentDonors` | רשימת תורמים שאישרו פרסום: `[{ "name": "משפחת לוי", "meters": 3 }]` | פס "עכשיו נתרם" מופיע רק כשהרשימה לא ריקה (עד 6 שמות) |
| `updatedAt` | תאריך עדכון, למשל `"2026-10-04"` | לתיעוד |

איך מעדכנים:
1. ב־GitHub פותחים את `data/campaign.json` ולוחצים על העיפרון (Edit).
2. משנים רק מספרים אמיתיים מדוח נדרים פלוס. שם תורם נכנס **רק באישורו**.
3. Commit ישירות ל־`main`. האתר מתעדכן תוך דקה או שתיים.
4. להסתרה: מחזירים את הערך ל־`null` (או `[]` לרשימה).

**אסור** להכניס מספר משוער, תורם לא אמיתי או "מכפיל" שלא קיים. ערך `null` פשוט מסתיר את הרכיב.

## הרצה מקומית

```bash
python3 -m http.server 8000   # ואז http://localhost:8000
```

פרמטרים לבדיקה: `?no3d` (בלי תלת־ממד), `?force3d` (מדלג על דירוג המכשיר), `?poster` (מצב סופי סטטי, לצילום ה־poster).

## בנייה מחדש של נכסים (רק אם משנים ספריות/תמונות)

```bash
mkdir /tmp/kz && cd /tmp/kz && npm i three@0.186.1 gsap@3.15.0 lenis@1.3.26 esbuild sharp qrcode @fontsource/heebo @fontsource/frank-ruhl-libre
KZ_MODULES=/tmp/kz/node_modules scripts/build-vendor.sh
NODE_PATH=/tmp/kz/node_modules node scripts/build-assets.cjs
```

## פרטי תרומה (כפי שמופיעים באתר)

- טלפון: 058-5555530 | 053-5470052
- אשראי / ביט: https://www.matara.pro/nedarimplus/online/?mosad=5776132
- העברה בנקאית: מזרחי טפחות, סניף 428, חשבון 294319
- הטבת מס: 35% לפי סעיף 46
