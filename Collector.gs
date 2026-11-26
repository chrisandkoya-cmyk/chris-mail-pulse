/**
 * สคริปต์ตัวลูกสำหรับบัญชี Gmail รองทั้ง 11 บัญชีของคริส (Collector.gs)
 * ตั้งค่ารหัส Google Sheet กลางให้เรียบร้อยแล้ว ไม่ต้องแก้โค้ดแม้แต่บรรทัดเดียว!
 * เพียงวางโค้ดนี้ในบัญชีรอง แล้วกดรัน setupCollectorTriggers 1 ครั้ง
 */

const COLLECTOR_CONFIG = {
  // รหัส Google Sheet กลางที่สร้างและแชร์สิทธิ์ให้ทั้ง 12 บัญชีของคริสเรียบร้อยแล้ว
  MASTER_SPREADSHEET_ID: '1qNuRcZ0X_nNajV_cq4_hYWWfLnJkTTyiNsAYARchXWk',
  LOOKBACK_HOURS: 14,
  TIMEZONE: 'Asia/Bangkok'
};

/**
 * ตั้งเวลาให้บัญชีรองส่งข้อมูลเข้า Sheet กลางตอน 04:45 น. และ 17:45 น. (ก่อนเวลาสรุปจริงของเมลหลัก 15 นาที)
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

  // ดึงเมลรอบแรกส่งเข้า Sheet กลางทันทีตอนกดติดตั้ง
  pushEmailsToMasterSheet();
}

/**
 * ดึงอีเมลใหม่ในบัญชีรองแล้วบันทึกลงแผ่นงาน RawInbox ของ Google Sheet กลางอัตโนมัติ
 */
function pushEmailsToMasterSheet() {
  const cutoffTime = new Date(new Date().getTime() - (COLLECTOR_CONFIG.LOOKBACK_HOURS * 60 * 60 * 1000));
  const afterEpoch = Math.floor(cutoffTime.getTime() / 1000);
  const accountEmail = (Session.getActiveUser().getEmail() || 'secondary@gmail.com').toLowerCase();

  const ss = SpreadsheetApp.openById(COLLECTOR_CONFIG.MASTER_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('RawInbox');
  if (!sheet) return;

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
