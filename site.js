/*
 * ToyoSeeds home — vanilla runtime (support.js / React 依存を排除した素のJS版)
 * 旧: <x-dc> + support.js(dc-runtime) が担っていた挙動を移植:
 *   - style-hover 属性の汎用ホバー適用
 *   - data-reveal のスクロールreveal
 *   - motion系クラス付与とmotion-in監視
 *   - ヘッダー縮小 / ヒーロー・Works の視差
 * カラー/フォントは静的CSSのデフォルト（ネイビー×グリーン / Zen Kaku）を使用。
 */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    // --- style-hover: 旧support.jsの汎用ホバー（属性はHTMLに残したまま処理） ---
    document.querySelectorAll('[style-hover]').forEach(function (el) {
      var hover = el.getAttribute('style-hover') || '';
      var base = el.getAttribute('style') || '';
      var sep = base && !/;\s*$/.test(base) ? ';' : '';
      el.addEventListener('pointerenter', function () { el.setAttribute('style', base + sep + hover); }, { passive: true });
      el.addEventListener('pointerleave', function () { el.setAttribute('style', base); }, { passive: true });
    });

    // --- ページ内ナビ（SWELLではbodyがスクロール領域になるため明示制御） ---
    function pageScroller() {
      return document.body.scrollHeight > document.documentElement.scrollHeight
        ? document.body
        : document.scrollingElement;
    }
    function scrollToHash(hash, smooth) {
      if (!hash || hash.charAt(0) !== '#') return false;
      var target = document.getElementById(hash.slice(1));
      if (!target) return false;
      var scroller = pageScroller();
      var header = document.querySelector('.site-header');
      var offset = header ? Math.ceil(header.getBoundingClientRect().height) + 10 : 76;
      var top = target.getBoundingClientRect().top + scroller.scrollTop - offset;
      scroller.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
      return true;
    }
    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (!link) return;
      var hash = link.getAttribute('href');
      if (!hash || !document.getElementById(hash.slice(1))) return;
      event.preventDefault();
      if (location.hash !== hash) history.pushState(null, '', hash);
      scrollToHash(hash, true);
    });
    addEventListener('hashchange', function () { scrollToHash(location.hash, true); });

    // --- ハッシュ付きで来たときのスクロール ---
    if (location.hash) {
      setTimeout(function () { scrollToHash(location.hash, false); }, 250);
    }

    // --- reveal（要素はデフォルトで可視。ビューポート進入でアニメクラスを付与するだけ） ---
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('reveal-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    function observeReveals() {
      document.querySelectorAll('[data-reveal]:not(.reveal-in)').forEach(function (el) { io.observe(el); });
    }
    setTimeout(observeReveals, 400);
    setTimeout(observeReveals, 1500);

    // --- motion ---
    var sections = [].slice.call(document.querySelectorAll('section'));
    sections.forEach(function (s) { s.classList.add('motion-section'); });

    var motionSelector = [
      '#services > div > p', '#services > div > h2', '#services article',
      '#model [data-reveal] > p', '#model [data-reveal] > h2', '#model [data-reveal] > div > div',
      '#works > div > p', '#works > div > h2',
      '#strength [data-reveal] > p', '#strength [data-reveal] > h2', '#strength [data-reveal] > div > div',
      '#ceo > div > p', '#ceo > div > h2', '#ceo > div > div > div',
      '#news > div:first-child', '#news > div:last-child > a',
      '#company [data-reveal] > p', '#company [data-reveal] > h2', '#company [data-reveal] > div',
      '#contact > p', '#contact > h2', '#contact > a'
    ].join(',');
    [].slice.call(document.querySelectorAll(motionSelector)).forEach(function (item, index) {
      item.classList.add('motion-item');
      item.style.setProperty('--motion-delay', (index % 5) * 75 + 'ms');
    });

    document.querySelectorAll(
      '#services article,#works .work-card,#strength [data-reveal] > div > div,#company [data-reveal] > div'
    ).forEach(function (card) { card.classList.add('motion-card'); });

    [].slice.call(document.querySelectorAll('a')).forEach(function (link) {
      var style = link.getAttribute('style') || '';
      if (style.indexOf('linear-gradient') > -1) link.classList.add('motion-cta');
    });

    var pageMotionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('motion-in'); pageMotionObserver.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6%' });
    sections.forEach(function (s) { pageMotionObserver.observe(s); });

    document.body.classList.add('motion-ready');

    // --- ヘッダー縮小 ---
    var header = document.querySelector('.site-header');
    function updateHeader() { if (header) header.classList.toggle('header-scrolled', scrollY > 32); }
    addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();

    // --- ヒーロー視差（pointer:fineのみ） ---
    var hero = document.querySelector('.hero-motion');
    if (hero && matchMedia('(pointer:fine)').matches) {
      hero.addEventListener('pointermove', function (event) {
        var rect = hero.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width - 0.5;
        var y = (event.clientY - rect.top) / rect.height - 0.5;
        hero.style.setProperty('--hero-x', (x * -16) + 'px');
        hero.style.setProperty('--hero-y', (y * -11) + 'px');
      }, { passive: true });
      hero.addEventListener('pointerleave', function () {
        hero.style.setProperty('--hero-x', '0px');
        hero.style.setProperty('--hero-y', '0px');
      });
    }

    // --- Works視差（pointer:fineのみ） ---
    var works = document.querySelector('.works-section');
    if (works && matchMedia('(pointer:fine)').matches) {
      works.addEventListener('pointermove', function (event) {
        var rect = works.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width - 0.5;
        var y = (event.clientY - rect.top) / rect.height - 0.5;
        works.style.setProperty('--works-x', (x * -18) + 'px');
        works.style.setProperty('--works-y', (y * -12) + 'px');
      }, { passive: true });
      works.addEventListener('pointerleave', function () {
        works.style.setProperty('--works-x', '0px');
        works.style.setProperty('--works-y', '0px');
      });
    }
  });
})();
