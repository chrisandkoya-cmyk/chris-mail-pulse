/**
 * สคริปต์ตัวลูกสำหรับบัญชี Gmail รอง (Collector.gs) — ทางเลือกเสริมหากไม่ต้องการตั้ง Auto-Forward
 * หน้าที่: ดึงอีเมลใหม่จากบัญชีรองแล้วส่งไปเก็บใน Google Sheet กลางของบัญชีหลักก่อนเวลา 05:00 และ 18:00 น.
 */

// ใส่รหัส Google Sheet (Spreadsheet ID) ของบัญชีหลัก และชื่อเรียกบัญชีรองนี้
const COLLECTOR_CONFIG = {
  MASTER_SPREADSHEET_ID: 'ใส่_SPREADSHEET_ID_ของบัญชีหลักที่นี่',
  ACCOUNT_LABEL: 'ใส่ชื่ออีเมลหรือชื่อเรียกบัญชีนี้ (เช่น chris.college@gmail.com)',
  LOOKBACK_HOURS: 14,
  TIMEZONE: 'Asia/Bangkok'
};

/**
 * ตั้งเวลาให้บัญชีรองส่งข้อมูลเข้า Sheet กลางตอน 04:45 น. และ 17:45 น. (ก่อนเวลาสรุปจริง 15 นาที)
 */
function setupCollectorTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'pushEmailsToMasterSheet') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // รันเวลา 04:45 น. (เตรียมข้อมูลให้รอบ 05:00 น.)
  ScriptApp.newTrigger('pushEmailsToMasterSheet')
    .timeBased()
    .everyDays(1)
    .atHour(4)
    .nearMinute(45)
    .inTimezone(COLLECTOR_CONFIG.TIMEZONE)
    .create();

  // รันเวลา 17:45 น. (เตรียมข้อมูลให้รอบ 18:00 น.)
  ScriptApp.newTrigger('pushEmailsToMasterSheet')
    .timeBased()
    .everyDays(1)
    .atHour(17)
    .nearMinute(45)
    .inTimezone(COLLECTOR_CONFIG.TIMEZONE)
    .create();
}

/**
 * ดึงอีเมลใหม่ในบัญชีรองแล้วบันทึกลงแผ่นงาน RawInbox ของ Google Sheet กลาง
 */
function pushEmailsToMasterSheet() {
  const cutoffTime = new Date(new Date().getTime() - (COLLECTOR_CONFIG.LOOKBACK_HOURS * 60 * 60 * 1000));
  const afterEpoch = Math.floor(cutoffTime.getTime() / 1000);
  const accountEmail = COLLECTOR_CONFIG.ACCOUNT_LABEL || Session.getActiveUser().getEmail();

  const ss = SpreadsheetApp.openById(COLLECTOR_CONFIG.MASTER_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('RawInbox');
  if (!sheet) return;

  // อ่านรายการ ID ที่เคยส่งไปแล้วเพื่อป้องกันการส่งซ้ำ
  const existingIds = {};
  if (sheet.getLastRow() > 1) {
    const idCol = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    idCol.forEach(function(r) { existingIds[String(r[0])] = true; });
  }

  const threads = GmailApp.search('after:' + afterEpoch + ' -in:trash -in:spam', 0, 25);
  threads.forEach(function(thread) {
    const messages = thread.getMessages();
    const msg = messages[messages.length - 1];
    if (msg.getDate() < cutoffTime) return;
    if (existingIds[msg.getId()]) return;

    const snippet = (msg.getPlainBody() || '').replace(/\s+/g, ' ').trim().substring(0, 600);
    const timeStr = Utilities.formatDate(msg.getDate(), COLLECTOR_CONFIG.TIMEZONE, 'HH:mm');
    const gmailUrl = 'https://mail.google.com/mail/u/0/#inbox/' + thread.getId();

    sheet.appendRow([
      msg.getId(),
      accountEmail,
      msg.getFrom(),
      msg.getSubject() || '(ไม่มีหัวข้อ)',
      snippet,
      timeStr,
      gmailUrl,
      'NO'
    ]);
  });
}
