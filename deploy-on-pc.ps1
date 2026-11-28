# สคริปต์ติดตั้ง Chris Mail Pulse อัตโนมัติบนคอมพิวเตอร์ของคริส (DESKTOP-U0AMFJ7)
# สำหรับให้ Antigravity บนคอมรันเพื่อ Deploy ขึ้น Google Apps Script ด้วย clasp ทันที

Write-Host "=== เริ่มติดตั้ง Chris Mail Pulse ขึ้น Google Apps Script ===" -ForegroundColor Cyan

# 1. ตรวจสอบและติดตั้ง @google/clasp
if (-not (Get-Command clasp -ErrorAction SilentlyContinue)) {
    Write-Host "กำลังติดตั้ง @google/clasp..." -ForegroundColor Yellow
    npm install -g @google/clasp
}

# 2. ล็อกอินเข้าบัญชี Google หลัก (noname04581@gmail.com)
Write-Host "กำลังเปิดเบราว์เซอร์เพื่อล็อกอินเมลหลัก noname04581@gmail.com..." -ForegroundColor Yellow
clasp login

# 3. สร้างโปรเจกต์ Google Apps Script และอัปโหลดไฟล์ทั้งหมด (Code.gs, index.html, appsscript.json)
if (-not (Test-Path ".clasp.json")) {
    Write-Host "กำลังสร้างโปรเจกต์ Chris Mail Pulse บน Google Apps Script..." -ForegroundColor Yellow
    clasp create --type webapp --title "Chris Mail Pulse (05:00 & 18:00)"
}

Write-Host "กำลังอัปโหลดโค้ด Code.gs และ index.html ขึ้น Google Apps Script..." -ForegroundColor Green
clasp push -f

# 4. เปิดหน้าโปรเจกต์เพื่อกด Run -> setupDailyTriggers 1 ครั้ง
Write-Host "อัปโหลดสำเร็จ! กำลังเปิดหน้า Google Apps Script เพื่อกด Run -> setupDailyTriggers..." -ForegroundColor Green
clasp open
