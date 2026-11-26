# คู่มือติดตั้ง Chris Mail Pulse (ฟรี 100% — เสร็จใน 3 นาที)

ระบบสรุปอีเมล Gmail หลายบัญชีอัตโนมัติด้วย **Google Apps Script + Gemini 2.5 Flash (Free Tier)**
แจ้งเตือนเข้า **Discord เวลา 05:00 น. และ 18:00 น.** พร้อม **หน้าเว็บ Dashboard ส่วนตัว** สำหรับเปิดบน **Xiaomi 14** และ **PC**

---

## ขั้นตอนที่ 1: รวมอีเมลจากหลายบัญชี Gmail (เลือกวิธีที่ชอบ)

### วิธี A: ตั้ง Auto-Forward เข้าเมลหลัก (แนะนำ — ง่ายที่สุด ไม่ต้องลงสคริปต์หลายที่)
1. เข้า Gmail **บัญชีรองแต่ละตัว** &rarr; กดไอคอนฟันเฟือง **การตั้งค่า (Settings)** &rarr; **ดูการตั้งค่าทั้งหมด (See all settings)**
2. ไปที่แท็บ **การส่งต่อและ POP/IMAP (Forwarding and POP/IMAP)**
3. กด **เพิ่มที่อยู่สำหรับส่งต่อ (Add a forwarding address)** &rarr; ใส่อีเมล **บัญชีหลักของคริส** แล้วกดยืนยัน
4. เลือก **"ส่งต่อสำเนาจดหมายขาเข้าไปยัง..."** แล้วกดบันทึก (ระบบใน `Code.gs` จะอ่าน Header `To:` และแยกป้ายชื่อบัญชีรองให้เองอัตโนมัติ)

### วิธี B: ใช้สคริปต์ตัวลูก `Collector.gs` (กรณีไม่อยาก Forward อีเมล)
1. ในบัญชีรอง ให้เปิด [script.google.com](https://script.google.com) &rarr; สร้างโปรเจกต์ใหม่ &rarr; วางโค้ดจากไฟล์ [`Collector.gs`](Collector.gs)
2. ใส่ `MASTER_SPREADSHEET_ID` ของบัญชีหลัก และชื่อบัญชีรอง
3. กดรันฟังก์ชัน `setupCollectorTriggers` 1 ครั้ง (มันจะส่งเมลใหม่เข้า Sheet กลางตอน `04:45` และ `17:45` ก่อนเวลาสรุปจริง 15 นาที)

---

## ขั้นตอนที่ 2: ติดตั้งสคริปต์หลักและหน้าเว็บ Dashboard

1. เข้าบัญชี Gmail หลักของคริส แล้วเปิด [script.google.com](https://script.google.com) &rarr; กด **โปรเจกต์ใหม่ (New Project)**
2. ในไฟล์ `Code.gs` ให้ลบโค้ดเดิมออก แล้วคัดลอกโค้ดทั้งหมดจาก [`Code.gs`](Code.gs) ไปวาง
3. กดปุ่ม **+** (เพิ่มไฟล์) มุมซ้ายบน &rarr; เลือก **HTML** &rarr; ตั้งชื่อไฟล์ว่า `index` (ไม่ต้องใส่ `.html`) แล้วคัดลอกโค้ดทั้งหมดจาก [`index.html`](index.html) ไปวาง
4. กดปุ่ม **ทำให้ใช้งานได้ (Deploy)** มุมขวาบน &rarr; **การทำให้ใช้งานได้รายการใหม่ (New deployment)**
   - ประเภท: เลือก **เว็บแอป (Web app)**
   - ดำเนินการในฐานะ (Execute as): **ฉัน (Me)**
   - ผู้ที่มีสิทธิ์เข้าถึง (Who has access): **เฉพาะฉัน (Only myself)** หรือ **ทุกคน (Anyone)** (หากต้องการเปิดดูบน Xiaomi 14 โดยไม่ต้องล็อกอินซ้ำ)
5. กด **Deploy** แล้วคัดลอกลิงก์ **Web App URL** เก็บไว้เปิดบน Xiaomi 14 ได้เลย

---

## ขั้นตอนที่ 3: เชื่อม Gemini API (ฟรี) + Discord Webhook + ตั้งเวลา 05:00 & 18:00 น.

1. **ขอ Gemini API Key ฟรี:** เข้า [aistudio.google.com/apikey](https://aistudio.google.com/apikey) &rarr; กด **Create API Key** (ฟรี ไม่เสียเงิน)
2. **สร้าง Discord Webhook:** เข้าห้อง Discord ของคริส &rarr; **ตั้งค่าช่อง (Edit Channel)** &rarr; **Integrations** &rarr; **Webhooks** &rarr; **New Webhook** &rarr; กด **Copy Webhook URL**
3. เปิดลิงก์ **Web App Dashboard** ที่ได้จากขั้นตอนที่ 2 &rarr; กดปุ่ม **"ตั้งค่า"** บนหน้าเว็บ &rarr; วาง **Gemini API Key** และ **Discord Webhook URL** แล้วกดบันทึก
4. กลับมาที่หน้า Google Apps Script &rarr; เลือกฟังก์ชัน `setupDailyTriggers` จากแถบด้านบน แล้วกด **เรียกใช้ (Run)** 1 ครั้ง
   - ระบบจะตั้งเวลาทำงานอัตโนมัติทุกวัน เวลา **05:00 น.** และ **18:00 น.** ทันที!
