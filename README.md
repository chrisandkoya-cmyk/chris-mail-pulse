# Chris Mail Pulse — ระบบสรุปอีเมล Gmail หลายบัญชีอัตโนมัติ (05:00 & 18:00 น.)

ระบบสรุปอีเมลหลายบัญชีอัตโนมัติสำหรับ **คริส (อัษฎาวุฒิ รัตนพันธ์)**
ใช้ **Google Apps Script + Gemini 2.5 Flash (Free Tier)** สรุปอีเมลเป็นภาษาไทย แยกหมวดความสำคัญ (`สำคัญ/ด่วน`, `ทั่วไป/ระบบ`, `โปรโมชัน`) ส่งแจ้งเตือนเข้า **Discord Webhook** ทุกวันเวลา **05:00 น.** และ **18:00 น.** พร้อม **หน้าเว็บ Dashboard ส่วนตัว** สำหรับเปิดบน **Xiaomi 14** และ **PC**

---

## ลิงก์ใช้งานด่วน
- **หน้าเว็บ Dashboard (GitHub Pages):** [https://chrisandkoya-cmyk.github.io/chris-mail-pulse/](https://chrisandkoya-cmyk.github.io/chris-mail-pulse/)
- **คู่มือติดตั้งละเอียด:** [`SETUP_GUIDE.md`](SETUP_GUIDE.md)
- **สถานะโปรเจกต์:** [`PROJECT_STATUS.md`](PROJECT_STATUS.md)

---

## ไฟล์ในโปรเจกต์
| ไฟล์ | หน้าที่ |
|---|---|
| [`Code.gs`](Code.gs) | โค้ดหลังบ้าน Google Apps Script (ดึงเมลหลายบัญชี, สรุปด้วย Gemini 2.5 Flash, ยิง Discord 05:00 & 18:00 น.) |
| [`index.html`](index.html) | หน้าเว็บ Dashboard (มีธีมเกรเดียนต์เคลื่อนไหว 6 แบบ, ปรับฟอนต์, ปรับขนาดตัวอักษร, ไฮไลต์คำสำคัญสีแน่น, ฟังเสียงสรุปภาษาไทย) |
| [`Collector.gs`](Collector.gs) | สคริปต์ตัวลูกสำหรับบัญชี Gmail รอง (ทางเลือกเสริมกรณีไม่ใช้ Auto-Forward) |
| [`appsscript.json`](appsscript.json) | ไฟล์ตั้งค่าเขตเวลา `Asia/Bangkok` สำหรับ Google Apps Script |
| [`manifest.json`](manifest.json) | ไฟล์ PWA สำหรับติดตั้งเป็นแอพบนหน้าจอโฮมของ Xiaomi 14 |

---

## วิธีติดตั้งใช้งานจริง (ทำครั้งเดียว 3 นาทีจบ)

1. **รวมเมลรองเข้าเมลหลัก:** ตั้งค่า `Forwarding` ใน Gmail บัญชีรองทุกตัวให้ส่งต่อเมลเข้าบัญชีหลักของคริส (ระบบแยกชื่อบัญชีให้เองอัตโนมัติ)
2. **วางโค้ดใน Google Apps Script:**
   - เปิด [script.google.com](https://script.google.com) (ด้วยเมลหลัก) &rarr; กด **โปรเจกต์ใหม่**
   - คัดลอกโค้ดจาก [`Code.gs`](Code.gs) ไปวางในไฟล์ `Code.gs`
   - กด **`+`** &rarr; เลือก **HTML** &rarr; ตั้งชื่อไฟล์ว่า `index` &rarr; คัดลอกโค้ดจาก [`index.html`](index.html) ไปวาง
3. **Deploy Web App:** กด **Deploy** &rarr; **New deployment** &rarr; เลือก **Web app** (`Execute as: Me`, `Who has access: Anyone`) &rarr; กด **Deploy**
4. **ใส่คีย์ & เปิดตั้งเวลาอัตโนมัติ:**
   - เปิดลิงก์ Web App Dashboard &rarr; กดปุ่ม **"บัญชี & API"** &rarr; ใส่ **Gemini API Key** (ขอฟรีที่ [aistudio.google.com/apikey](https://aistudio.google.com/apikey)) และ **Discord Webhook URL** แล้วกดบันทึก
   - ในหน้า `script.google.com` เลือกฟังก์ชัน `setupDailyTriggers` แล้วกด **Run** 1 ครั้ง
