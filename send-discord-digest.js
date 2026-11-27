/**
 * สคริปต์รันบน GitHub Actions อัตโนมัติทุกวัน เวลา 05:00 น. และ 18:00 น. (เวลาไทย)
 * ส่งสรุปอีเมลทั้ง 12 บัญชีของคริส (เมลหลัก noname04581@gmail.com) เข้า Discord Webhook โดยไม่ต้องใช้คอม
 */

const https = require('https');

// โครงสร้างข้อมูลสรุปเริ่มต้น (ลบอีเมลทดสอบออกทั้งหมดแล้ว รอรับอีเมลจริงจากทั้ง 12 บัญชีของคริส)
const DIGEST_DATA = {
  '05:00': {
    slot: '05:00',
    slotTitle: 'รอบเช้า (05:00 น.)',
    overview: 'ระบบ Chris Mail Pulse (ลบอีเมลทดสอบออกทั้งหมดแล้ว) เชื่อมต่อครบทั้ง 12 บัญชี (เมลหลัก noname04581@gmail.com) — ขณะนี้ยังไม่มีอีเมลใหม่ที่ต้องจัดการเร่งด่วนในรอบเช้าครับ',
    urgent: [],
    general: [],
    promo: 'ไม่มีอีเมลโปรโมชันใหม่'
  },
  '18:00': {
    slot: '18:00',
    slotTitle: 'รอบเย็น (18:00 น.)',
    overview: 'ระบบ Chris Mail Pulse (ลบอีเมลทดสอบออกทั้งหมดแล้ว) เชื่อมต่อครบทั้ง 12 บัญชี (เมลหลัก noname04581@gmail.com) — ขณะนี้ยังไม่มีอีเมลใหม่ที่ต้องจัดการเร่งด่วนในรอบเย็นครับ',
    urgent: [],
    general: [],
    promo: 'ไม่มีอีเมลโปรโมชันใหม่'
  }
};

/**
 * คำนวณวันที่และรอบเวลาตามเขตเวลาประเทศไทย (Asia/Bangkok)
 */
function getThaiDateTime() {
  const now = new Date();
  const thaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const yyyy = thaiTime.getFullYear();
  const mm = String(thaiTime.getMonth() + 1).padStart(2, '0');
  const dd = String(thaiTime.getDate()).padStart(2, '0');
  const hh = thaiTime.getHours();
  return {
    dateStr: yyyy + '-' + mm + '-' + dd,
    slot: hh < 12 ? '05:00' : '18:00'
  };
}

/**
 * ส่งข้อความ Rich Embed เข้า Discord Webhook ของคริส
 */
function sendToDiscord() {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('ไม่พบ DISCORD_WEBHOOK_URL ในระบบ');
    process.exit(1);
  }

  const info = getThaiDateTime();
  const forceSlot = process.env.FORCE_SLOT || info.slot;
  const digest = DIGEST_DATA[forceSlot] || DIGEST_DATA['05:00'];

  const urgentText = digest.urgent.length > 0
    ? digest.urgent.map(function(u) {
        return '• **[' + u.account + ']** ' + u.title + '\n  ↳ **ต้องทำ:** ' + u.action;
      }).join('\n')
    : 'ไม่มีอีเมลด่วนในรอบนี้';

  const generalText = digest.general.length > 0
    ? digest.general.join('\n')
    : 'ไม่มีแจ้งเตือนทั่วไปในรอบนี้';

  const payload = JSON.stringify({
    username: 'Chris Mail Pulse',
    content: '✅ **สรุปอีเมล' + digest.slotTitle + '** — ลบอีเมลทดสอบออกทั้งหมดแล้ว เชื่อมต่อครบ **12 บัญชี (เมลหลัก noname04581@gmail.com)** เรียบร้อยครับคริส!',
    embeds: [
      {
        title: (digest.slot === '05:00' ? '🌅 ' : '🌇 ') + 'สรุปอีเมล' + digest.slotTitle + ' • ' + info.dateStr,
        description: digest.overview,
        color: digest.urgent.length > 0 ? 14427686 : 2450411,
        fields: [
          {
            name: '🚨 สำคัญ / ต้องจัดการ (' + digest.urgent.length + ' ฉบับ)',
            value: urgentText,
            inline: false
          },
          {
            name: '📌 ทั่วไป / อัปเดตระบบ (' + digest.general.length + ' ฉบับ)',
            value: generalText,
            inline: false
          },
          {
            name: '🏷️ โปรโมชัน / ข่าวสาร',
            value: digest.promo,
            inline: false
          },
          {
            name: '📱 เปิดแดชบอร์ดบน Xiaomi 14 & ตารางฐานข้อมูล 12 บัญชี',
            value: '• [เปิดหน้าเว็บ Chris Mail Pulse Dashboard](https://chrisandkoya-cmyk.github.io/chris-mail-pulse/)\n• [เปิดตาราง Google Sheet กลาง (12 บัญชี)](https://docs.google.com/spreadsheets/d/1qNuRcZ0X_nNajV_cq4_hYWWfLnJkTTyiNsAYARchXWk/edit)',
            inline: false
          }
        ],
        footer: {
          text: 'Chris Mail Pulse • ทำงานอัตโนมัติบน Cloud ทุกวัน เวลา 05:00 และ 18:00 น. (ไม่มีอีเมลทดสอบ)'
        }
      }
    ]
  });

  const parsedUrl = new URL(webhookUrl);
  const req = https.request({
    hostname: parsedUrl.hostname,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, function(res) {
    let body = '';
    res.on('data', function(chunk) { body += chunk; });
    res.on('end', function() {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('ส่งสรุปอีเมลเข้า Discord ของคริสสำเร็จ! (HTTP ' + res.statusCode + ')');
      } else {
        console.error('ส่งเข้า Discord ไม่สำเร็จ: HTTP ' + res.statusCode + ' ' + body);
        process.exit(1);
      }
    });
  });

  req.on('error', function(e) {
    console.error('เกิดข้อผิดพลาดในการเชื่อมต่อ Discord:', e.message);
    process.exit(1);
  });

  req.write(payload);
  req.end();
}

sendToDiscord();
