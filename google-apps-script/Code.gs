const DEFAULT_CONTACT_TO = 'hiroyatoyoshima@toyoseeds.com';

function doPost(event) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty('CONTACT_SECRET');
    const contactTo = properties.getProperty('CONTACT_TO_EMAIL') || DEFAULT_CONTACT_TO;
    const payload = JSON.parse(event && event.postData ? event.postData.contents : '{}');

    if (!expectedSecret || !safeEqual(String(payload.secret || ''), expectedSecret)) {
      throw new Error('Unauthorized request');
    }

    // 社長日記の「スキ」（/api/like から届く）。お問い合わせとは action の有無で見分ける
    if (payload.action === 'like' || payload.action === 'unlike' || payload.action === 'get') {
      return jsonResponse(handleLike(payload));
    }

    const name = clean(payload.name, 80);
    const company = clean(payload.company, 120);
    const email = clean(payload.email, 254).toLowerCase();
    const message = clean(payload.message, 5000);

    if (!name || !message || !isValidEmail(email)) {
      throw new Error('Invalid contact payload');
    }

    preventRapidDuplicate(email);

    const safeName = escapeHtml(name);
    const safeCompany = escapeHtml(company || '（未入力）');
    const safeEmail = escapeHtml(email);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
    const subjectName = name.replace(/[\r\n]+/g, ' ');

    MailApp.sendEmail({
      to: contactTo,
      replyTo: email,
      name: 'ToyoSeeds Webサイト',
      subject: '【ToyoSeeds】お問い合わせ：' + subjectName,
      body:
        'Webサイトからお問い合わせがありました。\n\n' +
        'お名前：' + name + '\n' +
        '会社名・団体名：' + (company || '（未入力）') + '\n' +
        'メールアドレス：' + email + '\n\n' +
        'お問い合わせ内容：\n' + message,
      htmlBody:
        '<h2>Webサイトからお問い合わせがありました</h2>' +
        '<p><strong>お名前</strong><br>' + safeName + '</p>' +
        '<p><strong>会社名・団体名</strong><br>' + safeCompany + '</p>' +
        '<p><strong>メールアドレス</strong><br>' + safeEmail + '</p>' +
        '<p><strong>お問い合わせ内容</strong><br>' + safeMessage + '</p>'
    });

    MailApp.sendEmail({
      to: email,
      replyTo: contactTo,
      name: 'ToyoSeeds合同会社',
      subject: '【ToyoSeeds】お問い合わせを受け付けました',
      body:
        name + ' 様\n\n' +
        'ToyoSeeds合同会社へお問い合わせいただき、ありがとうございます。\n' +
        '以下の内容で受け付けました。営業3日以内に担当者よりご返答いたします。\n\n' +
        '――――――――――\n' + message + '\n――――――――――\n\n' +
        '※このメールは自動送信です。お心当たりがない場合は、このメールへご返信ください。\n\n' +
        'ToyoSeeds合同会社',
      htmlBody:
        '<p>' + safeName + ' 様</p>' +
        '<p>ToyoSeeds合同会社へお問い合わせいただき、ありがとうございます。<br>' +
        '以下の内容で受け付けました。営業3日以内に担当者よりご返答いたします。</p>' +
        '<div style="margin:24px 0;padding:18px;border-left:4px solid #43A047;background:#F4F8F3">' + safeMessage + '</div>' +
        '<p style="color:#68718C;font-size:13px">※このメールは自動送信です。お心当たりがない場合は、このメールへご返信ください。</p>' +
        '<p>ToyoSeeds合同会社</p>'
    });

    return jsonResponse({ok: true});
  } catch (error) {
    console.error(error);
    return jsonResponse({ok: false, message: '送信に失敗しました。'});
  }
}

function clean(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeEqual(actual, expected) {
  if (actual.length !== expected.length) return false;
  let result = 0;
  for (let index = 0; index < actual.length; index += 1) {
    result |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return result === 0;
}

function preventRapidDuplicate(email) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email)
    .map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); })
    .join('');
  const cache = CacheService.getScriptCache();
  if (cache.get(digest)) throw new Error('Duplicate request');
  cache.put(digest, '1', 30);
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---- 社長日記の「スキ」 ----
// 台帳はスプレッドシート「社長日記スキ」（初回に自動作成し、IDをスクリプトプロパティ LIKES_SHEET_ID に保存）。
// 列: slug / タイトル / スキ / 最終更新。1記事1行。
const LIKES_SHEET_NAME = '社長日記スキ';

function handleLike(payload) {
  const slug = clean(payload.slug, 60);
  if (!/^(shachonikki|sahchonikki)_day\d{1,3}$/.test(slug)) throw new Error('Invalid slug');
  const title = clean(payload.title, 80).replace(/[\r\n]+/g, ' ');
  const delta = payload.action === 'like' ? 1 : payload.action === 'unlike' ? -1 : 0;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = likesSheet();
    const values = sheet.getDataRange().getValues();
    let row = -1;
    for (let index = 1; index < values.length; index += 1) {
      if (String(values[index][0]) === slug) { row = index + 1; break; }
    }

    let count;
    if (row < 0) {
      count = Math.max(0, delta);
      sheet.appendRow([slug, title, count, new Date()]);
    } else {
      const current = Number(values[row - 1][2]) || 0;
      count = Math.max(0, current + delta);
      if (delta !== 0) {
        sheet.getRange(row, 3).setValue(count);
        sheet.getRange(row, 4).setValue(new Date());
      }
      if (title && !String(values[row - 1][1] || '').trim()) sheet.getRange(row, 2).setValue(title);
    }
    return {ok: true, count: count};
  } finally {
    lock.releaseLock();
  }
}

function likesSheet() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty('LIKES_SHEET_ID');
  let spreadsheet = null;
  if (savedId) {
    try { spreadsheet = SpreadsheetApp.openById(savedId); } catch (error) { spreadsheet = null; }
  }
  if (!spreadsheet) {
    spreadsheet = SpreadsheetApp.create(LIKES_SHEET_NAME);
    properties.setProperty('LIKES_SHEET_ID', spreadsheet.getId());
  }
  const sheet = spreadsheet.getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['slug', 'タイトル', 'スキ', '最終更新']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
