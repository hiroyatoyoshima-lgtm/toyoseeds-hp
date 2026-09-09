// 社長日記の「スキ」。件数の取得と、押す／取り消しを Google Apps Script（台帳＝スプレッドシート）へ中継する。
//   GET  /api/like?slug=shachonikki_day55&title=vol55%20ベクトル  → {ok, count}
//   POST /api/like {slug, action: "like" | "unlike", title}         → {ok, count}
// 環境変数はお問い合わせフォームと共用（GOOGLE_APPS_SCRIPT_URL / CONTACT_SHARED_SECRET）。
const SLUG_RE = /^(shachonikki|sahchonikki)_day\d{1,3}$/;

function parseBody(request) {
  if (typeof request.body === 'string') return JSON.parse(request.body || '{}');
  return request.body || {};
}

function cleanTitle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  let slug;
  let action;
  let title;
  if (request.method === 'GET') {
    slug = String((request.query && request.query.slug) || '');
    title = cleanTitle(request.query && request.query.title);
    action = 'get';
  } else if (request.method === 'POST') {
    let body;
    try {
      body = parseBody(request);
    } catch {
      return response.status(400).json({message: '送信内容を確認してください。'});
    }
    slug = String(body.slug || '');
    title = cleanTitle(body.title);
    action = body.action === 'unlike' ? 'unlike' : 'like';
  } else {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({message: 'GET か POST で送信してください。'});
  }

  if (!SLUG_RE.test(slug)) {
    return response.status(400).json({message: '記事が見つかりません。'});
  }

  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  const sharedSecret = process.env.CONTACT_SHARED_SECRET;
  if (!scriptUrl || !sharedSecret) {
    return response.status(503).json({message: 'スキは準備中です。'});
  }

  try {
    const result = await fetch(scriptUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      redirect: 'follow',
      body: JSON.stringify({action, slug, title, secret: sharedSecret})
    });
    if (!result.ok) throw new Error(`Google Apps Script HTTP ${result.status}`);
    const data = await result.json();
    if (!data.ok) throw new Error(data.error || 'Google Apps Script rejected the request');
    return response.status(200).json({ok: true, count: Number(data.count) || 0});
  } catch (error) {
    console.error('like relay failed', error);
    return response.status(502).json({message: 'スキを記録できませんでした。'});
  }
}
