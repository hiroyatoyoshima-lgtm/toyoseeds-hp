/*
 * 社長日記の「スキ」ボタン。
 * - 記事末尾の .like-btn[data-slug] を1つだけ扱う
 * - 押した状態は localStorage（suki:<slug>）に記憶。同じ端末では1回だけ、もう一度押すと取り消し
 * - 件数は /api/like から取得。届くまでは数字を出さない（0件のときも出さない）
 * - 通信に失敗したら押す前の状態に戻す
 */
(function () {
  'use strict';

  var btn = document.querySelector('.like-btn[data-slug]');
  if (!btn || !window.fetch) return;

  var slug = btn.getAttribute('data-slug');
  var countEl = btn.parentNode.querySelector('.like-count');
  var key = 'suki:' + slug;
  var h1 = document.querySelector('.article-title h1');
  var title = h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : '';

  var liked = false;
  try { liked = localStorage.getItem(key) === '1'; } catch (e) {}
  var count = null; // null = まだ分からない

  function remember(on) {
    try {
      if (on) localStorage.setItem(key, '1');
      else localStorage.removeItem(key);
    } catch (e) {}
  }

  function render() {
    btn.classList.toggle('on', liked);
    btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
    btn.setAttribute('aria-label', liked ? 'スキを取り消す' : 'スキ');
    if (countEl) countEl.textContent = count !== null && count > 0 ? String(count) : '';
  }

  function pop() {
    btn.classList.remove('pop');
    void btn.offsetWidth;
    btn.classList.add('pop');
  }

  render();

  fetch('/api/like?slug=' + encodeURIComponent(slug) + '&title=' + encodeURIComponent(title), {credentials: 'omit'})
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (d && typeof d.count === 'number') { count = d.count; render(); }
    })
    .catch(function () {});

  var busy = false;
  btn.addEventListener('click', function () {
    if (busy) return;
    busy = true;

    var next = !liked;
    liked = next;
    if (count !== null) count = Math.max(0, count + (next ? 1 : -1));
    remember(next);
    if (next) pop();
    render();

    fetch('/api/like', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      credentials: 'omit',
      body: JSON.stringify({slug: slug, action: next ? 'like' : 'unlike', title: title})
    })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
      .then(function (d) {
        if (d && typeof d.count === 'number') { count = d.count; render(); }
      })
      .catch(function () {
        liked = !next;
        if (count !== null) count = Math.max(0, count + (next ? -1 : 1));
        remember(liked);
        render();
      })
      .then(function () { busy = false; });
  });
})();
