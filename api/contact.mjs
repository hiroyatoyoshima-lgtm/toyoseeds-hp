function parseBody(request) {
  if (typeof request.body === 'string') return JSON.parse(request.body || '{}');
  return request.body || {};
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({message: 'POSTで送信してください。'});
  }

  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  const sharedSecret = process.env.CONTACT_SHARED_SECRET;
  if (!scriptUrl || !sharedSecret) {
    return response.status(503).json({message: '現在、お問い合わせフォームを準備中です。'});
  }

  let body;
  try {
    body = parseBody(request);
  } catch {
    return response.status(400).json({message: '送信内容を確認してください。'});
  }

  const name = String(body.name || '').trim();
  const company = String(body.company || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const message = String(body.message || '').trim();
  const startedAt = Number(body.startedAt || 0);

  if (body.website) return response.status(200).json({ok: true});
  if (!body.privacy || !name || !email || !message) {
    return response.status(400).json({message: '必須項目を入力してください。'});
  }
  if (name.length > 80 || company.length > 120 || message.length > 5000 || !validEmail(email)) {
    return response.status(400).json({message: '入力内容を確認してください。'});
  }
  if (!startedAt || Date.now() - startedAt < 2500 || Date.now() - startedAt > 86400000) {
    return response.status(400).json({message: 'ページを再読み込みして、もう一度送信してください。'});
  }

  try {
    const result = await fetch(scriptUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      redirect: 'follow',
      body: JSON.stringify({name, company, email, message, secret: sharedSecret})
    });
    if (!result.ok) throw new Error(`Google Apps Script HTTP ${result.status}`);
    const data = await result.json();
    if (!data.ok) throw new Error('Google Apps Script rejected the request');
  } catch (error) {
    console.error('Gmail contact delivery failed', error);
    return response.status(502).json({message: '送信に失敗しました。'});
  }

  return response.status(200).json({ok: true});
}
