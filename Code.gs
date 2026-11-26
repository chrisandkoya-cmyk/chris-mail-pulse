/**
 * ระบบสรุปอีเมลหลายบัญชีอัตโนมัติ (Chris Mail Pulse)
 * ทำงานเวลา 05:00 น. และ 18:00 น. สรุปด้วย Gemini API (Free Tier)
 * ส่งแจ้งเตือนเข้า Discord Webhook และแสดงผลบนหน้าเว็บ Dashboard
 */

// ค่าเริ่มต้นของระบบ (สามารถตั้งค่าผ่านหน้าเว็บ Dashboard หรือใส่ใน Script Properties ได้)
const DEFAULT_CONFIG = {
  GEMINI_MODEL: 'gemini-2.5-flash',
  LOOKBACK_HOURS: 14,
  MAX_EMAILS_PER_RUN: 35,
  TIMEZONE: 'Asia/Bangkok'
};

/**
 * เปิดหน้าเว็บ Dashboard เมื่อเข้าใช้งานผ่านลิงก์ Web App
 */
function doGet(e) {
  // ถ้าเรียกพร้อมพารามิเตอร์ ?api=data ให้คืนค่าเป็น JSON สำหรับดึงข้อมูลภายนอก
  if (e && e.parameter && e.parameter.api === 'data') {
    const payload = getDashboardData();
    return ContentService.createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // แสดงหน้าเว็บ Dashboard จากไฟล์ index.html
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Chris Mail Pulse — แดชบอร์ดสรุปอีเมล')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=5');
}

/**
 * ตั้งเวลาทำงานอัตโนมัติ 2 รอบต่อวัน: 05:00 น. และ 18:00 น.
 * ให้กดรันฟังก์ชันนี้เพียงครั้งเดียวตอนติดตั้งครั้งแรก
 */
function setupDailyTriggers() {
  // ลบ Trigger เดิมออกก่อนเพื่อป้องกันการทำงานซ้ำซ้อน
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    const handler = trigger.getHandlerFunction();
    if (handler === 'runMorningDigest' || handler === 'runEveningDigest') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // สร้าง Trigger รอบเช้า เวลา 05:00 น.
  ScriptApp.newTrigger('runMorningDigest')
    .timeBased()
    .everyDays(1)
    .atHour(5)
    .nearMinute(0)
    .inTimezone(DEFAULT_CONFIG.TIMEZONE)
    .create();

  // สร้าง Trigger รอบเย็น เวลา 18:00 น.
  ScriptApp.newTrigger('runEveningDigest')
    .timeBased()
    .everyDays(1)
    .atHour(18)
    .nearMinute(0)
    .inTimezone(DEFAULT_CONFIG.TIMEZONE)
    .create();

  return {
    success: true,
    message: 'ตั้งเวลาสรุปอัตโนมัติรอบ 05:00 น. และ 18:00 น. เรียบร้อยแล้ว'
  };
}

/**
 * ฟังก์ชันสำหรับ Trigger รอบเช้า (05:00 น.)
 */
function runMorningDigest() {
  return executeDigestCycle('05:00', 'รอบเช้า (05:00 น.)');
}

/**
 * ฟังก์ชันสำหรับ Trigger รอบเย็น (18:00 น.)
 */
function runEveningDigest() {
  return executeDigestCycle('18:00', 'รอบเย็น (18:00 น.)');
}

/**
 * สั่งรันสรุปอีเมลทันทีจากปุ่มบนหน้าเว็บ Dashboard
 */
function triggerManualSync(slotLabel) {
  const nowStr = Utilities.formatDate(new Date(), DEFAULT_CONFIG.TIMEZONE, 'HH:mm');
  const slot = slotLabel || (Number(nowStr.split(':')[0]) < 12 ? '05:00' : '18:00');
  const title = slot === '05:00' ? 'รอบเช้า (05:00 น.)' : 'รอบเย็น (18:00 น.)';
  return executeDigestCycle(slot, title);
}

/**
 * กระบวนการหลัก: ดึงอีเมลทุกบัญชี -> ให้ Gemini สรุป -> บันทึกลง Sheet -> ส่งเข้า Discord
 */
function executeDigestCycle(slotCode, slotTitle) {
  const config = getAppConfig();
  const rawEmails = collectAllEmails(config);

  // กรณีไม่มีอีเมลใหม่เข้ามาในช่วงเวลาที่กำหนด
  if (rawEmails.length === 0) {
    const emptyDigest = {
      id: 'digest_' + new Date().getTime(),
      date: Utilities.formatDate(new Date(), DEFAULT_CONFIG.TIMEZONE, 'yyyy-MM-dd'),
      slot: slotCode,
      slotTitle: slotTitle,
      createdAt: Utilities.formatDate(new Date(), DEFAULT_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm'),
      overview: 'ไม่มีอีเมลใหม่เข้ามาในรอบนี้ ทุกบัญชีสะอาดเรียบร้อยครับคริส',
      items: []
    };
    saveDigestToSheet(emptyDigest);
    if (config.discordWebhookUrl) {
      sendDiscordDigest(config.discordWebhookUrl, emptyDigest, config.dashboardUrl);
    }
    return emptyDigest;
  }

  // ส่งข้อมูลอีเมลให้ Gemini สรุปและจัดหมวดหมู่
  const aiResult = summarizeWithGemini(rawEmails, config.geminiApiKey, slotTitle);

  const digestRecord = {
    id: 'digest_' + new Date().getTime(),
    date: Utilities.formatDate(new Date(), DEFAULT_CONFIG.TIMEZONE, 'yyyy-MM-dd'),
    slot: slotCode,
    slotTitle: slotTitle,
    createdAt: Utilities.formatDate(new Date(), DEFAULT_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm'),
    overview: aiResult.overview,
    items: aiResult.items
  };

  // บันทึกผลสรุปลง Google Sheet เพื่อให้หน้าเว็บ Dashboard ดึงไปแสดงผล
  saveDigestToSheet(digestRecord);

  // ส่งแจ้งเตือนเข้า Discord Webhook
  if (config.discordWebhookUrl) {
    sendDiscordDigest(config.discordWebhookUrl, digestRecord, config.dashboardUrl);
  }

  return digestRecord;
}

/**
 * ดึงอีเมลจากบัญชีหลัก (รวมเมลที่ Auto-Forward มาจากบัญชีรอง) และจากตาราง RawInbox (กรณีใช้สคริปต์ตัวลูก)
 */
function collectAllEmails(config) {
  const collected = [];
  const cutoffTime = new Date(new Date().getTime() - (DEFAULT_CONFIG.LOOKBACK_HOURS * 60 * 60 * 1000));
  const afterEpoch = Math.floor(cutoffTime.getTime() / 1000);
  const myPrimaryEmail = Session.getActiveUser().getEmail() || 'บัญชีหลัก';

  // 1. ค้นหาอีเมลใหม่ใน Gmail บัญชีหลัก
  const query = 'after:' + afterEpoch + ' -in:trash -in:spam';
  const threads = GmailApp.search(query, 0, DEFAULT_CONFIG.MAX_EMAILS_PER_RUN);

  threads.forEach(function(thread) {
    const messages = thread.getMessages();
    const msg = messages[messages.length - 1];
    if (msg.getDate() < cutoffTime) return;

    // ตรวจสอบว่าอีเมลนี้ส่งถึงบัญชีไหน (รองรับกรณี Forward มาจากเมลรองของคริส)
    const targetAccount = detectTargetAccount(msg, myPrimaryEmail);
    const plainBody = (msg.getPlainBody() || '').replace(/\s+/g, ' ').trim().substring(0, 700);

    collected.push({
      id: msg.getId(),
      threadId: thread.getId(),
      account: targetAccount,
      sender: msg.getFrom(),
      subject: msg.getSubject() || '(ไม่มีหัวข้อ)',
      snippet: plainBody,
      timestamp: Utilities.formatDate(msg.getDate(), DEFAULT_CONFIG.TIMEZONE, 'HH:mm'),
      gmailUrl: 'https://mail.google.com/mail/u/0/#inbox/' + thread.getId()
    });
  });

  // 2. ดึงอีเมลจากแผ่นงาน RawInbox (กรณีบัญชีรองใช้ Collector.gs ส่งข้อมูลเข้ามา)
  const sheetEmails = consumeExternalCollectorEmails();
  sheetEmails.forEach(function(item) {
    collected.push(item);
  });

  return collected;
}

/**
 * ตรวจจับชื่อบัญชีปลายทางที่แท้จริงจาก Header ของอีเมล (รองรับหลายบัญชีที่ Forward มารวมกัน)
 */
function detectTargetAccount(message, fallbackEmail) {
  const toHeader = message.getTo() || '';
  const emailMatch = toHeader.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch && emailMatch[0]) {
    return emailMatch[0].toLowerCase();
  }
  return fallbackEmail.toLowerCase();
}

/**
 * ส่งรายการอีเมลให้ Gemini 2.5 Flash สรุปเป็นภาษาไทยและแยกหมวดหมู่
 */
function summarizeWithGemini(emails, apiKey, slotTitle) {
  // หากยังไม่ได้ตั้งค่า Gemini API Key ให้ใช้ระบบจัดหมวดหมู่อัตโนมัติเบื้องต้นแทนเพื่อไม่ให้ระบบหยุดทำงาน
  if (!apiKey) {
    return buildFallbackSummary(emails, 'ยังไม่ได้ใส่ Gemini API Key (แสดงสรุปเบื้องต้นจากหัวข้ออีเมล)');
  }

  const promptText = [
    'คุณคือผู้ช่วยส่วนตัวของ "คริส" (นักศึกษา ปวส. เทคโนโลยีธุรกิจดิจิทัล และนักพัฒนาเกม/แอพ)',
    'หน้าที่ของคุณคืออ่านรายการอีเมลจากหลายบัญชีใน ' + slotTitle + ' แล้วสรุปเป็นภาษาไทยที่สั้น ตรงประเด็น อ่านเข้าใจทันที',
    '',
    'กฎการจัดหมวดหมู่ (category):',
    '- "urgent": เรื่องสำคัญมากหรือต้องรีบทำ เช่น งานเรียน วิทยาลัย อาจารย์ งานส่ง แจ้งเตือนความปลอดภัย ธนาคาร/การเงิน หรือคนติดต่อเรื่องงานโดยตรง',
    '- "general": แจ้งเตือนระบบทั่วไป เช่น GitHub, Unity, Google Drive, อัปเดตซอฟต์แวร์, ใบเสร็จทั่วไป',
    '- "promo": โฆษณา โปรโมชัน ข่าวสารการตลาด ส่วนลดร้านค้า',
    '',
    'ตอบกลับเป็น JSON เท่านั้น ตามโครงสร้างนี้:',
    '{',
    '  "overview": "สรุปภาพรวม 2-3 ประโยคสั้นๆ ว่ามีเมลสำคัญกี่ฉบับ เรื่องอะไรที่คริสต้องรีบดูเป็นพิเศษ",',
    '  "items": [',
    '    {',
    '      "id": "รหัส id เดิมของอีเมล",',
    '      "category": "urgent หรือ general หรือ promo",',
    '      "summaryTitle": "หัวข้อสรุปภาษาไทยสั้นๆ กระชับ",',
    '      "summaryPoints": ["ใจความสำคัญข้อ 1", "ใจความสำคัญข้อ 2"],',
    '      "actionItem": "สิ่งที่คริสต้องทำ (ถ้าไม่มีให้ใส่ค่าว่าง)"',
    '    }',
    '  ]',
    '}',
    '',
    'รายการอีเมลที่ต้องสรุป:',
    JSON.stringify(emails.map(function(e) {
      return {
        id: e.id,
        account: e.account,
        sender: e.sender,
        subject: e.subject,
        snippet: e.snippet
      };
    }))
  ].join('\n');

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + DEFAULT_CONFIG.GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(apiKey);
  const payload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const json = JSON.parse(response.getContentText());
    const rawText = json.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(rawText);

    // รวมข้อมูลสรุปจาก AI เข้ากับข้อมูลอีเมลต้นฉบับ
    const byId = {};
    (parsed.items || []).forEach(function(item) {
      byId[item.id] = item;
    });

    const mergedItems = emails.map(function(orig) {
      const ai = byId[orig.id] || {};
      return {
        id: orig.id,
        account: orig.account,
        sender: orig.sender,
        originalSubject: orig.subject,
        timestamp: orig.timestamp,
        gmailUrl: orig.gmailUrl,
        category: ai.category || 'general',
        summaryTitle: ai.summaryTitle || orig.subject,
        summaryPoints: ai.summaryPoints || [orig.snippet.substring(0, 140)],
        actionItem: ai.actionItem || '',
        done: false
      };
    });

    return {
      overview: parsed.overview || 'สรุปอีเมลทั้งหมด ' + emails.length + ' ฉบับเรียบร้อยแล้ว',
      items: mergedItems
    };
  } catch (err) {
    // กรณีเรียก API ไม่สำเร็จ ให้ใช้ระบบสรุปสำรองแทนเพื่อไม่ให้พลาดการแจ้งเตือน
    return buildFallbackSummary(emails, 'สรุปอัตโนมัติโหมดสำรอง (' + err.message + ')');
  }
}

/**
 * ระบบสรุปสำรองกรณีไม่มีคีย์หรือโควตา Gemini เต็ม
 */
function buildFallbackSummary(emails, noteText) {
  const items = emails.map(function(orig) {
    const text = (orig.subject + ' ' + orig.snippet).toLowerCase();
    let category = 'general';
    if (text.indexOf('ด่วน') !== -1 || text.indexOf('ส่งงาน') !== -1 || text.indexOf('สอบ') !== -1 || text.indexOf('security') !== -1 || text.indexOf('alert') !== -1) {
      category = 'urgent';
    } else if (text.indexOf('sale') !== -1 || text.indexOf('ลดราคา') !== -1 || text.indexOf('โปรโมชัน') !== -1 || text.indexOf('unsubscribe') !== -1) {
      category = 'promo';
    }

    return {
      id: orig.id,
      account: orig.account,
      sender: orig.sender,
      originalSubject: orig.subject,
      timestamp: orig.timestamp,
      gmailUrl: orig.gmailUrl,
      category: category,
      summaryTitle: orig.subject,
      summaryPoints: [orig.snippet.substring(0, 150) || 'ไม่มีข้อความเพิ่มเติม'],
      actionItem: category === 'urgent' ? 'ตรวจสอบและตอบกลับอีเมลนี้' : '',
      done: false
    };
  });

  const urgentCount = items.filter(function(i) { return i.category === 'urgent'; }).length;
  return {
    overview: 'พบอีเมลใหม่ ' + items.length + ' ฉบับ (สำคัญ/ด่วน ' + urgentCount + ' ฉบับ) — ' + noteText,
    items: items
  };
}

/**
 * ส่งข้อความสรุปแบบ Rich Embed เข้า Discord Webhook ของคริส
 */
function sendDiscordDigest(webhookUrl, digest, dashboardUrl) {
  const items = digest.items || [];
  const urgentItems = items.filter(function(i) { return i.category === 'urgent'; });
  const generalItems = items.filter(function(i) { return i.category === 'general'; });
  const promoItems = items.filter(function(i) { return i.category === 'promo'; });

  // สร้างข้อความรายการด่วน
  const urgentLines = urgentItems.length > 0
    ? urgentItems.slice(0, 6).map(function(i) {
        const action = i.actionItem ? '\n   ↳ **ต้องทำ:** ' + i.actionItem : '';
        return '• **[' + i.account + ']** ' + i.summaryTitle + ' (' + i.timestamp + ')' + action;
      }).join('\n')
    : 'ไม่มีอีเมลด่วนในรอบนี้';

  // สร้างข้อความรายการทั่วไป
  const generalLines = generalItems.length > 0
    ? generalItems.slice(0, 6).map(function(i) {
        return '• **[' + i.account + ']** ' + i.summaryTitle;
      }).join('\n')
    : 'ไม่มีแจ้งเตือนทั่วไป';

  // ยุบรวมโปรโมชันเป็นบรรทัดเดียวไม่ให้รก
  const promoLine = promoItems.length > 0
    ? 'มีอีเมลโปรโมชัน/ข่าวสาร ' + promoItems.length + ' ฉบับ (' + promoItems.slice(0, 4).map(function(i) { return i.summaryTitle; }).join(', ') + ')'
    : 'ไม่มีอีเมลโฆษณา';

  const fields = [
    {
      name: '🚨 สำคัญ / ต้องจัดการ (' + urgentItems.length + ' ฉบับ)',
      value: urgentLines.substring(0, 1020),
      inline: false
    },
    {
      name: '📌 ทั่วไป / อัปเดตระบบ (' + generalItems.length + ' ฉบับ)',
      value: generalLines.substring(0, 1020),
      inline: false
    },
    {
      name: '🏷️ โปรโมชัน / ข่าวสาร (' + promoItems.length + ' ฉบับ)',
      value: promoLine.substring(0, 1020),
      inline: false
    }
  ];

  if (dashboardUrl) {
    fields.push({
      name: '📱 เปิดดูแดชบอร์ดตัวเต็ม (Xiaomi 14 / PC)',
      value: '[คลิกเปิด Chris Mail Pulse Dashboard](' + dashboardUrl + ')',
      inline: false
    });
  }

  const embedPayload = {
    username: 'Chris Mail Pulse',
    content: urgentItems.length > 0
      ? '🔔 **สรุปอีเมล' + digest.slotTitle + '** — มีเมลด่วน **' + urgentItems.length + ' ฉบับ** ที่คริสควรดูครับ'
      : '✅ **สรุปอีเมล' + digest.slotTitle + '** — ไม่มีเมลด่วน',
    embeds: [
      {
        title: (digest.slot === '05:00' ? '🌅 ' : '🌇 ') + 'สรุปอีเมล' + digest.slotTitle + ' • ' + digest.date,
        description: digest.overview,
        color: urgentItems.length > 0 ? 14427686 : 2450411,
        fields: fields,
        footer: {
          text: 'Chris Mail Pulse • รันอัตโนมัติเวลา 05:00 และ 18:00 น.'
        }
      }
    ]
  };

  UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(embedPayload),
    muteHttpExceptions: true
  });
}

/**
 * อ่านและบันทึกข้อมูลลง Google Sheet อัตโนมัติ (สร้าง Sheet ให้อัตโนมัติหากยังไม่มี)
 */
function getOrCreateDatabaseSheet() {
  const props = PropertiesService.getScriptProperties();
  let sheetId = props.getProperty('SPREADSHEET_ID');
  let ss = null;

  if (sheetId) {
    try {
      ss = SpreadsheetApp.openById(sheetId);
    } catch (e) {
      ss = null;
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.create('Chris_Mail_Pulse_Database');
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }

  // สร้างแผ่นงาน Digests สำหรับเก็บประวัติสรุปรายวัน
  let digestSheet = ss.getSheetByName('Digests');
  if (!digestSheet) {
    digestSheet = ss.insertSheet('Digests');
    digestSheet.appendRow(['id', 'date', 'slot', 'createdAt', 'jsonPayload']);
  }

  // สร้างแผ่นงาน RawInbox สำหรับรับอีเมลจากบัญชีรอง
  let rawSheet = ss.getSheetByName('RawInbox');
  if (!rawSheet) {
    rawSheet = ss.insertSheet('RawInbox');
    rawSheet.appendRow(['id', 'account', 'sender', 'subject', 'snippet', 'timestamp', 'gmailUrl', 'processed']);
  }

  return ss;
}

/**
 * บันทึกผลสรุปรอบล่าสุดลงในแผ่นงาน Digests
 */
function saveDigestToSheet(digestRecord) {
  try {
    const ss = getOrCreateDatabaseSheet();
    const sheet = ss.getSheetByName('Digests');
    sheet.appendRow([
      digestRecord.id,
      digestRecord.date,
      digestRecord.slot,
      digestRecord.createdAt,
      JSON.stringify(digestRecord)
    ]);
  } catch (e) {
    // กรณียังไม่ได้เปิดสิทธิ์ Spreadsheet ให้ข้ามการบันทึกลงตารางโดยไม่ทำให้ระบบล่ม
  }
}

/**
 * ดึงอีเมลจากแผ่นงาน RawInbox ที่ส่งมาจากบัญชีรอง แล้วทำเครื่องหมายว่าอ่านแล้ว
 */
function consumeExternalCollectorEmails() {
  try {
    const ss = getOrCreateDatabaseSheet();
    const sheet = ss.getSheetByName('RawInbox');
    if (!sheet || sheet.getLastRow() <= 1) return [];

    const rows = sheet.getDataRange().getValues();
    const results = [];
    for (let i = 1; i < rows.length; i++) {
      const processed = rows[i][7];
      if (processed !== 'YES') {
        results.push({
          id: String(rows[i][0]),
          account: String(rows[i][1]),
          sender: String(rows[i][2]),
          subject: String(rows[i][3]),
          snippet: String(rows[i][4]),
          timestamp: String(rows[i][5]),
          gmailUrl: String(rows[i][6])
        });
        sheet.getRange(i + 1, 8).setValue('YES');
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}

/**
 * ดึงข้อมูลสรุปทั้งหมดส่งให้หน้าเว็บ Dashboard
 */
function getDashboardData() {
  const config = getAppConfig();
  try {
    const ss = getOrCreateDatabaseSheet();
    const sheet = ss.getSheetByName('Digests');
    const lastRow = sheet.getLastRow();
    const digests = [];

    if (lastRow > 1) {
      const startRow = Math.max(2, lastRow - 14);
      const numRows = lastRow - startRow + 1;
      const values = sheet.getRange(startRow, 1, numRows, 5).getValues();
      for (let i = values.length - 1; i >= 0; i--) {
        try {
          digests.push(JSON.parse(values[i][4]));
        } catch (err) {}
      }
    }

    return {
      success: true,
      hasApiKey: Boolean(config.geminiApiKey),
      hasDiscordWebhook: Boolean(config.discordWebhookUrl),
      spreadsheetId: config.spreadsheetId,
      digests: digests
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
      digests: []
    };
  }
}

/**
 * อ่านค่าการตั้งค่าจาก Script Properties
 */
function getAppConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    geminiApiKey: props.getProperty('GEMINI_API_KEY') || '',
    discordWebhookUrl: props.getProperty('DISCORD_WEBHOOK_URL') || '',
    spreadsheetId: props.getProperty('SPREADSHEET_ID') || '',
    dashboardUrl: props.getProperty('DASHBOARD_URL') || ScriptApp.getService().getUrl() || ''
  };
}

/**
 * บันทึกค่าการตั้งค่า (Gemini API Key & Discord Webhook URL) จากหน้าเว็บ Dashboard
 */
function saveConfigFromWeb(newConfig) {
  const props = PropertiesService.getScriptProperties();
  if (newConfig.geminiApiKey !== undefined && newConfig.geminiApiKey !== '') {
    props.setProperty('GEMINI_API_KEY', newConfig.geminiApiKey.trim());
  }
  if (newConfig.discordWebhookUrl !== undefined && newConfig.discordWebhookUrl !== '') {
    props.setProperty('DISCORD_WEBHOOK_URL', newConfig.discordWebhookUrl.trim());
  }
  if (newConfig.dashboardUrl !== undefined && newConfig.dashboardUrl !== '') {
    props.setProperty('DASHBOARD_URL', newConfig.dashboardUrl.trim());
  }
  return {
    success: true,
    message: 'บันทึกการตั้งค่าและเชื่อมระบบเรียบร้อยแล้ว'
  };
}
