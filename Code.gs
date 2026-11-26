/**
 * ระบบสรุปอีเมลหลายบัญชีอัตโนมัติ (Chris Mail Pulse)
 * ตั้งค่าพร้อมใช้งานสำหรับคริส (อัษฎาวุฒิ รัตนพันธ์)
 * เมลหลัก: noname04581@gmail.com และเมลรองอีก 11 บัญชี
 * ทำงานเวลา 05:00 น. และ 18:00 น. สรุปด้วย Gemini 2.5 Flash (Free Tier) และส่งเข้า Discord
 */

// ค่าตั้งต้นที่เชื่อมกับฐานข้อมูล Google Sheet ของคริสไว้เรียบร้อยแล้ว
const DEFAULT_CONFIG = {
  PRIMARY_EMAIL: 'noname04581@gmail.com',
  DEFAULT_SPREADSHEET_ID: '1qNuRcZ0X_nNajV_cq4_hYWWfLnJkTTyiNsAYARchXWk',
  DEFAULT_DASHBOARD_URL: 'https://chrisandkoya-cmyk.github.io/chris-mail-pulse/',
  GEMINI_MODEL: 'gemini-2.5-flash',
  LOOKBACK_HOURS: 14,
  MAX_EMAILS_PER_RUN: 40,
  TIMEZONE: 'Asia/Bangkok'
};

// รายชื่อบัญชี Gmail ทั้ง 12 บัญชีของคริส
const CHRIS_ACCOUNTS = [
  { email: 'noname04581@gmail.com', label: 'Remuru noname (เมลหลัก)', role: 'MAIN' },
  { email: 'chrisandkoya@gmail.com', label: 'koya chris (Pro)', role: 'SUB' },
  { email: 'zaqdera@gmail.com', label: 'rimuru msatercell', role: 'SUB' },
  { email: 'msatergenshi@gmail.com', label: 'Atsadawod Genshi', role: 'SUB' },
  { email: 'zaq04581@gmail.com', label: 'Master Cell', role: 'SUB' },
  { email: 'zaq04581za@gmail.com', label: 'อัษฎาวุฒิ รัตนพันธ์', role: 'SUB' },
  { email: 'hyakx33@gmail.com', label: 'กอ หญ้า', role: 'SUB' },
  { email: 'saengphengsbithiphy@gmail.com', label: 'สใบทิพย์ แสงเพ็ง', role: 'SUB' },
  { email: 'koya.1650202017@gmail.com', label: 'สใบทิพย์', role: 'SUB' },
  { email: 'koya165020@gmail.com', label: 'สใบทิพย์ แสงเพ็ง (2)', role: 'SUB' },
  { email: 'zaq04581zaza@gmail.com', label: 'DE Za', role: 'SUB' },
  { email: 'oatthawut113366@gmail.com', label: 'OATTHAWUT RATTANAPHUN', role: 'SUB' }
];

/**
 * เปิดหน้าเว็บ Dashboard หรือส่งข้อมูล JSON เมื่อเรียกพร้อม ?api=data
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.api === 'data') {
    const payload = getDashboardData();
    return ContentService.createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Chris Mail Pulse — แดชบอร์ดสรุปอีเมล 12 บัญชี')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=5');
}

/**
 * ตั้งเวลาทำงานอัตโนมัติ 2 รอบต่อวัน: 05:00 น. และ 18:00 น.
 * กดรันฟังก์ชันนี้เพียงครั้งเดียวในหน้า Google Apps Script
 */
function setupDailyTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    const handler = trigger.getHandlerFunction();
    if (handler === 'runMorningDigest' || handler === 'runEveningDigest') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // รอบเช้า 05:00 น.
  ScriptApp.newTrigger('runMorningDigest')
    .timeBased()
    .everyDays(1)
    .atHour(5)
    .nearMinute(0)
    .inTimezone(DEFAULT_CONFIG.TIMEZONE)
    .create();

  // รอบเย็น 18:00 น.
  ScriptApp.newTrigger('runEveningDigest')
    .timeBased()
    .everyDays(1)
    .atHour(18)
    .nearMinute(0)
    .inTimezone(DEFAULT_CONFIG.TIMEZONE)
    .create();

  return {
    success: true,
    message: 'ตั้งเวลาสรุปอัตโนมัติรอบ 05:00 น. และ 18:00 น. สำหรับทั้ง 12 บัญชีเรียบร้อยแล้ว'
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
 * กระบวนการหลัก: ดึงอีเมลจากทั้ง 12 บัญชี -> ให้ Gemini สรุป -> บันทึกลง Sheet -> ส่งเข้า Discord
 */
function executeDigestCycle(slotCode, slotTitle) {
  const config = getAppConfig();
  const rawEmails = collectAllEmails(config);

  if (rawEmails.length === 0) {
    const emptyDigest = {
      id: 'digest_' + new Date().getTime(),
      date: Utilities.formatDate(new Date(), DEFAULT_CONFIG.TIMEZONE, 'yyyy-MM-dd'),
      slot: slotCode,
      slotTitle: slotTitle,
      createdAt: Utilities.formatDate(new Date(), DEFAULT_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm'),
      overview: 'ไม่มีอีเมลใหม่เข้ามาในรอบนี้ ทั้ง 12 บัญชีของคริสสะอาดเรียบร้อยครับ',
      items: []
    };
    saveDigestToSheet(emptyDigest);
    if (config.discordWebhookUrl) {
      sendDiscordDigest(config.discordWebhookUrl, emptyDigest, config.dashboardUrl);
    }
    return emptyDigest;
  }

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

  saveDigestToSheet(digestRecord);

  if (config.discordWebhookUrl) {
    sendDiscordDigest(config.discordWebhookUrl, digestRecord, config.dashboardUrl);
  }

  return digestRecord;
}

/**
 * ดึงอีเมลจากเมลหลัก noname04581@gmail.com (รวมเมลที่ส่งต่อมาจากเมลรอง) และจากแผ่นงาน RawInbox
 */
function collectAllEmails(config) {
  const collected = [];
  const cutoffTime = new Date(new Date().getTime() - (DEFAULT_CONFIG.LOOKBACK_HOURS * 60 * 60 * 1000));
  const afterEpoch = Math.floor(cutoffTime.getTime() / 1000);
  const myPrimaryEmail = Session.getActiveUser().getEmail() || DEFAULT_CONFIG.PRIMARY_EMAIL;

  // 1. ค้นหาอีเมลใหม่ใน Gmail บัญชีหลัก
  const query = 'after:' + afterEpoch + ' -in:trash -in:spam';
  const threads = GmailApp.search(query, 0, DEFAULT_CONFIG.MAX_EMAILS_PER_RUN);

  threads.forEach(function(thread) {
    const messages = thread.getMessages();
    const msg = messages[messages.length - 1];
    if (msg.getDate() < cutoffTime) return;

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

  // 2. ดึงอีเมลจากแผ่นงาน RawInbox (ที่ส่งมาจากบัญชีรองอีก 11 บัญชีผ่าน Collector.gs)
  const sheetEmails = consumeExternalCollectorEmails();
  sheetEmails.forEach(function(item) {
    collected.push(item);
  });

  return collected;
}

/**
 * ตรวจจับว่าอีเมลฉบับนั้นเป็นของบัญชีไหนใน 12 บัญชีของคริส
 */
function detectTargetAccount(message, fallbackEmail) {
  const combinedHeader = ((message.getTo() || '') + ' ' + (message.getCc ? (message.getCc() || '') : '')).toLowerCase();

  // ตรวจสอบเทียบกับรายชื่ออีเมลทั้ง 12 บัญชีของคริสก่อน
  for (let i = 0; i < CHRIS_ACCOUNTS.length; i++) {
    const knownEmail = CHRIS_ACCOUNTS[i].email.toLowerCase();
    if (combinedHeader.indexOf(knownEmail) !== -1) {
      return knownEmail;
    }
  }

  const emailMatch = combinedHeader.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch && emailMatch[0]) {
    return emailMatch[0].toLowerCase();
  }
  return (fallbackEmail || DEFAULT_CONFIG.PRIMARY_EMAIL).toLowerCase();
}

/**
 * ส่งรายการอีเมลให้ Gemini 2.5 Flash สรุปเป็นภาษาไทยและแยกหมวดหมู่
 */
function summarizeWithGemini(emails, apiKey, slotTitle) {
  if (!apiKey) {
    return buildFallbackSummary(emails, 'ยังไม่ได้ใส่ Gemini API Key (แสดงสรุปเบื้องต้นจากหัวข้ออีเมล)');
  }

  const promptText = [
    'คุณคือผู้ช่วยส่วนตัวของ "คริส" (อัษฎาวุฒิ รัตนพันธ์ — นักศึกษา ปวส. เทคโนโลยีธุรกิจดิจิทัล ห้อง สบค.11 และนักพัฒนาเกม/แอพ)',
    'หน้าที่ของคุณคืออ่านรายการอีเมลจาก 12 บัญชีของคริสใน ' + slotTitle + ' แล้วสรุปเป็นภาษาไทยที่สั้น ตรงประเด็น อ่านเข้าใจทันที',
    '',
    'กฎการจัดหมวดหมู่ (category):',
    '- "urgent": เรื่องสำคัญมากหรือต้องรีบทำ เช่น งานเรียน วิทยาลัย อาจารย์ งานส่ง แจ้งเตือนความปลอดภัย ธนาคาร/การเงิน หรือคนติดต่อเรื่องงานโดยตรง',
    '- "general": แจ้งเตือนระบบทั่วไป เช่น GitHub, Unity, Google Drive, อัปเดตซอฟต์แวร์, ใบเสร็จทั่วไป',
    '- "promo": โฆษณา โปรโมชัน ข่าวสารการตลาด ส่วนลดร้านค้า',
    '',
    'ตอบกลับเป็น JSON เท่านั้น ตามโครงสร้างนี้:',
    '{',
    '  "overview": "สรุปภาพรวม 2-3 ประโยคสั้นๆ ว่ามีเมลสำคัญกี่ฉบับ จากบัญชีไหน และเรื่องอะไรที่คริสต้องรีบดูเป็นพิเศษ",',
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

  const urgentLines = urgentItems.length > 0
    ? urgentItems.slice(0, 6).map(function(i) {
        const action = i.actionItem ? '\n   ↳ **ต้องทำ:** ' + i.actionItem : '';
        return '• **[' + i.account + ']** ' + i.summaryTitle + ' (' + i.timestamp + ')' + action;
      }).join('\n')
    : 'ไม่มีอีเมลด่วนในรอบนี้';

  const generalLines = generalItems.length > 0
    ? generalItems.slice(0, 6).map(function(i) {
        return '• **[' + i.account + ']** ' + i.summaryTitle;
      }).join('\n')
    : 'ไม่มีแจ้งเตือนทั่วไป';

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

  const targetUrl = dashboardUrl || DEFAULT_CONFIG.DEFAULT_DASHBOARD_URL;
  if (targetUrl) {
    fields.push({
      name: '📱 เปิดดูแดชบอร์ดตัวเต็ม (Xiaomi 14 / PC)',
      value: '[คลิกเปิด Chris Mail Pulse Dashboard](' + targetUrl + ')',
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
          text: 'Chris Mail Pulse (เมลหลัก noname04581@gmail.com + 11 บัญชี) • 05:00 & 18:00 น.'
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
 * เชื่อมต่อกับฐานข้อมูล Google Sheet (ใช้ Sheet ID ที่สร้างให้คริสไว้แล้วโดยอัตโนมัติ)
 */
function getOrCreateDatabaseSheet() {
  const props = PropertiesService.getScriptProperties();
  let sheetId = props.getProperty('SPREADSHEET_ID') || DEFAULT_CONFIG.DEFAULT_SPREADSHEET_ID;
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

  let digestSheet = ss.getSheetByName('Digests');
  if (!digestSheet) {
    digestSheet = ss.insertSheet('Digests');
    digestSheet.appendRow(['id', 'date', 'slot', 'createdAt', 'jsonPayload']);
  }

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
  } catch (e) {}
}

/**
 * ดึงอีเมลจากแผ่นงาน RawInbox ที่ส่งมาจากบัญชีรอง แล้วทำเครื่องหมายว่าประมวลผลแล้ว
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
      primaryEmail: DEFAULT_CONFIG.PRIMARY_EMAIL,
      accounts: CHRIS_ACCOUNTS,
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
    spreadsheetId: props.getProperty('SPREADSHEET_ID') || DEFAULT_CONFIG.DEFAULT_SPREADSHEET_ID,
    dashboardUrl: props.getProperty('DASHBOARD_URL') || DEFAULT_CONFIG.DEFAULT_DASHBOARD_URL
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
