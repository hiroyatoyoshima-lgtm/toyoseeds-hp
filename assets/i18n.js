/*
 * ToyoSeeds — 日本語 / English 切り替え
 *
 * 使い方（HTML側）:
 *   <p data-en="English text">日本語のテキスト</p>      … 中身（HTML可）を差し替える
 *   <img data-en-alt="..."> / <meta data-en-content="...">
 *   <a data-en-title="..." data-en-aria-label="..." data-en-placeholder="...">
 *   <a class="lang-toggle" href="?lang=en" data-lang-toggle>EN</a>   … 切り替えボタン
 *   <span class="en-only"> / <span class="ja-only">                  … 片方の言語だけ表示
 *
 * 言語の決め方: URLの ?lang= → localStorage の記憶 → ブラウザの言語（日本語以外なら英語）
 * 切り替えると document に 'toyoseeds:langchange' を投げるので、JS側の文言もそれで差し替える。
 */
(function () {
  'use strict';

  var KEY = 'toyoseeds-lang';
  var ATTRS = ['content', 'alt', 'placeholder', 'title', 'aria-label'];

  function camel(attr) {
    return attr.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
  }

  function readStored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function writeStored(lang) {
    try { localStorage.setItem(KEY, lang); } catch (e) { /* プライベートモード等 */ }
  }

  function normalize(value) {
    return value === 'en' || value === 'ja' ? value : null;
  }

  function initialLang() {
    var fromUrl = null;
    try { fromUrl = normalize(new URLSearchParams(location.search).get('lang')); } catch (e) {}
    if (fromUrl) return fromUrl;

    var fromStore = normalize(readStored());
    if (fromStore) return fromStore;

    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'ja';
    return /^ja\b/i.test(nav) ? 'ja' : 'en';
  }

  function applyText(lang) {
    document.querySelectorAll('[data-en]').forEach(function (el) {
      if (el.dataset.ja === undefined) el.dataset.ja = el.innerHTML;
      el.innerHTML = lang === 'en' ? el.dataset.en : el.dataset.ja;
    });
  }

  function applyAttrs(lang) {
    ATTRS.forEach(function (attr) {
      var enKey = camel('en-' + attr);
      var jaKey = camel('ja-' + attr);
      document.querySelectorAll('[data-en-' + attr + ']').forEach(function (el) {
        if (el.dataset[jaKey] === undefined) el.dataset[jaKey] = el.getAttribute(attr) || '';
        el.setAttribute(attr, lang === 'en' ? el.dataset[enKey] : el.dataset[jaKey]);
      });
    });
  }

  function applyToggles(lang) {
    document.querySelectorAll('[data-lang-toggle]').forEach(function (el) {
      var next = lang === 'en' ? 'ja' : 'en';
      el.textContent = next === 'en' ? 'EN' : '日本語';
      el.setAttribute('aria-label', next === 'en' ? 'Switch to English' : '日本語に切り替える');
      el.setAttribute('lang', next === 'en' ? 'en' : 'ja');
      if (el.tagName === 'A') el.setAttribute('href', '?lang=' + next);
    });
  }

  function apply(lang) {
    document.documentElement.lang = lang;
    applyText(lang);
    applyAttrs(lang);
    applyToggles(lang);
    document.dispatchEvent(new CustomEvent('toyoseeds:langchange', { detail: { lang: lang } }));
  }

  var current = initialLang();
  apply(current);

  // 現在の言語をほかのスクリプトから読めるようにしておく
  window.toyoSeedsLang = function () { return current; };

  document.addEventListener('click', function (event) {
    var toggle = event.target.closest('[data-lang-toggle]');
    if (!toggle) return;
    event.preventDefault();

    current = current === 'en' ? 'ja' : 'en';
    writeStored(current);
    apply(current);

    // 共有できるように URL にも残す（リロードはしない）
    try {
      var url = new URL(location.href);
      url.searchParams.set('lang', current);
      history.replaceState(null, '', url);
    } catch (e) { /* 古いブラウザは URL 更新なしで動く */ }
  });
})();
