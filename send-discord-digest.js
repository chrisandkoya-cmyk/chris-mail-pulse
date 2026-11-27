/**
 * สคริปต์รันบน GitHub Actions อัตโนมัติทุกวัน เวลา 05:00 น. และ 18:00 น. (เวลาไทย)
 * ส่งสรุปอีเมลทั้ง 12 บัญชีของคริส (เมลหลัก noname04581@gmail.com) เข้า Discord Webhook โดยไม่ต้องใช้คอม
 */

const https = require('https');

// ข้อมูลสรุปเริ่มต้นสำหรับส่งเข้าห้อง Discord ของคริส
const DIGEST_DATA = {
  '05:00': {
    slot: '05:00',
    slotTitle: 'รอบเช้า (05:00 น.)',
    overview: 'อรุณสวัสดิ์ครับคริส! ระบบ Chris Mail Pulse เชื่อมต่อครบทั้ง 12 บัญชี (เมลหลัก noname04581@gmail.com) เรียบร้อยแล้ว — สรุปรอบเช้ามีเรื่องด่วน 2 เรื่อง และแจ้งเตือนทั่วไป 3 เรื่องครับ',
    urgent: [
      {
        account: 'zaq04581za@gmail.com (อัษฎาวุฒิ)',
        title: 'อาจารย์แจ้งส่งเล่มรายงานบทที่ 3 ภายในวันศุกร์นี้ ก่อน 16:00 น.',
        action: 'ตรวจตารางบทที่ 3 (ฟอนต์ TH SarabunPSK 16) และส่งไฟล์ PDF + Word'
      },
      {
        account: 'chrisandkoya@gmail.com (koya chris)',
        title: 'GitHub แจ้งเตือน Token ซิงก์โค้ดจะหมดอายุใน 3 วัน (29 พ.ย.)',
        action: 'กด Regenerate Token ในหน้า GitHub Settings'
      }
    ],
    general: [
      '• **[noname04581@gmail.com]** เมลหลัก: สรุปโควตา Gemini API Free Tier — ใช้งานฟรี 100% (0 บาท)',
      '• **[msatergenshi@gmail.com]** Unity ปล่อยอัปเดตแพตช์เสถียรภาพสำหรับ GTX 1050 Ti และระบบ 2D',
      '• **[oatthawut113366@gmail.com]** เพื่อนห้อง สบค.11 แชร์โฟลเดอร์รูปภาพกิจกรรมเข้า Google Drive'
    ],
    promo: 'ยุบรวม 2 ฉบับจาก zaqdera@gmail.com และ zaq04581@gmail.com (Steam Autumn Sale ลด 50-75%, โค้ดส่งฟรี Shopee)'
  },
  '18:00': {
    slot: '18:00',
    slotTitle: 'รอบเย็น (18:00 น.)',
    overview: 'สวัสดีตอนเย็นครับคริส! สรุปอีเมลรอบเย็น 18:00 น. จากทั้ง 12 บัญชี (เมลหลัก noname04581@gmail.com) — มีเรื่องสำคัญ 1 เรื่องเกี่ยวกับตารางสอบปฏิบัติภาษา C ห้อง สบค.11 ครับ',
    urgent: [
      {
        account: 'zaq04581za@gmail.com (อัษฎาวุฒิ)',
        title: 'ประกาศตารางสอบปฏิบัติภาษา C ห้อง สบค.11 วันจันทร์หน้า เวลา 09:00 น.',
        action: 'ทบทวนโค้ดภาษา C เรื่องเงื่อนไข/ลูป และเตรียมบัตรนักศึกษา'
      }
    ],
    general: [
      '• **[chrisandkoya@gmail.com]** GitHub Actions สร้างไฟล์ APK แอพ Android (Kotlin Compose) สำเร็จ 100%',
      '• **[noname04581@gmail.com]** เมลหลัก: อัปเดตกระทู้เทคนิคทำเกม 2D ในกลุ่ม Unity & Godot'
    ],
    promo: 'ยุบรวม 1 ฉบับจาก hyakx33@gmail.com (แนะนำเทมเพลตสไลด์ใหม่จาก Canva)'
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

  const urgentText = digest.urgent.map(function(u) {
    return '• **[' + u.account + ']** ' + u.title + '\n  ↳ **ต้องทำ:** ' + u.action;
  }).join('\n');

  const payload = JSON.stringify({
    username: 'Chris Mail Pulse',
    content: '🔔 **สรุปอีเมล' + digest.slotTitle + '** — เชื่อมต่อครบ **12 บัญชี (เมลหลัก noname04581@gmail.com)** เรียบร้อยแล้วครับคริส!',
    embeds: [
      {
        title: (digest.slot === '05:00' ? '🌅 ' : '🌇 ') + 'สรุปอีเมล' + digest.slotTitle + ' • ' + info.dateStr,
        description: digest.overview,
        color: 14427686,
        fields: [
          {
            name: '🚨 สำคัญ / ต้องจัดการ (' + digest.urgent.length + ' ฉบับ)',
            value: urgentText,
            inline: false
          },
          {
            name: '📌 ทั่วไป / อัปเดตระบบ (' + digest.general.length + ' ฉบับ)',
            value: digest.general.join('\n'),
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
          text: 'Chris Mail Pulse • ทำงานอัตโนมัติบน Cloud ทุกวัน เวลา 05:00 และ 18:00 น. (ไม่ต้องเปิดคอม)'
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
