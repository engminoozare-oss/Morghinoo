/* مرغینو — رابط کاربری
 * همه‌ی صفحه‌ها با رشته‌ی HTML ساخته می‌شوند و رویدادها با data-act
 * روی ظرف اصلی مدیریت می‌شوند تا کد ساده و سبک بماند.
 */
(function (global) {
  'use strict';

  var J = global.J, Store = global.Store, Calc = global.Calc, Notify = global.Notify;

  var state = { tab: 'report', fcrDate: null };

  /* ================= ابزارهای کوچک ================= */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var toastTimer = null;
  function toast(msg, ms) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, ms || 2200);
  }

  /* ================= پنجره‌ی شناور ================= */

  function modal(opts) {
    closeModal();
    var root = $('#modal-root');
    var wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal-head">' +
          '<h2>' + esc(opts.title) + '</h2>' +
          '<button class="icon-btn" data-act="close-modal" aria-label="بستن">✕</button>' +
        '</div>' +
        '<div class="modal-body">' + (opts.body || '') + '</div>' +
        (opts.footer === null ? '' : '<div class="modal-foot">' + (opts.footer ||
          '<button class="btn ghost" data-act="close-modal">انصراف</button>' +
          '<button class="btn" data-act="modal-ok">ثبت</button>') + '</div>') +
      '</div>';
    root.appendChild(wrap);

    wrap.addEventListener('click', function (ev) {
      if (ev.target === wrap) closeModal();
      var btn = ev.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'close-modal') { closeModal(); return; }
      if (act === 'modal-ok') { if (opts.onOk) opts.onOk(wrap); return; }
      if (opts.onAct) opts.onAct(act, btn, wrap);
    });

    if (opts.onMount) opts.onMount(wrap);
    return wrap;
  }

  function closeModal() { $('#modal-root').innerHTML = ''; }

  function confirmBox(title, message, onYes, yesLabel) {
    modal({
      title: title,
      body: '<p style="font-size:17px">' + esc(message) + '</p>',
      footer: '<button class="btn ghost" data-act="close-modal">نه</button>' +
              '<button class="btn danger" data-act="modal-ok">' + esc(yesLabel || 'بله، انجام بده') + '</button>',
      onOk: function () { closeModal(); onYes(); }
    });
  }

  /* ================= انتخاب تاریخ شمسی ================= */

  function jdateHTML(name, iso, opts) {
    opts = opts || {};
    var j = J.isoToJ(iso || J.todayISO());
    var nowY = J.isoToJ(J.todayISO()).jy;
    var years = [], i;
    for (i = nowY + 1; i >= nowY - 5; i--) years.push(i);

    var yOpts = years.map(function (y) {
      return '<option value="' + y + '"' + (y === j.jy ? ' selected' : '') + '>' + J.faDigits(y) + '</option>';
    }).join('');
    var mOpts = J.monthNames.map(function (m, idx) {
      return '<option value="' + (idx + 1) + '"' + (idx + 1 === j.jm ? ' selected' : '') + '>' + m + '</option>';
    }).join('');
    var dOpts = '';
    for (i = 1; i <= 31; i++) {
      dOpts += '<option value="' + i + '"' + (i === j.jd ? ' selected' : '') + '>' + J.faDigits(i) + '</option>';
    }

    return '<div class="jdate" data-jdate="' + name + '">' +
      '<select data-part="y">' + yOpts + '</select>' +
      '<select data-part="m">' + mOpts + '</select>' +
      '<select data-part="d">' + dOpts + '</select>' +
      '</div>' +
      (opts.quick === false ? '' :
        '<div class="chips" style="margin-top:8px">' +
          '<button type="button" class="chip" data-act="jd-today" data-target="' + name + '">امروز</button>' +
          '<button type="button" class="chip" data-act="jd-yesterday" data-target="' + name + '">دیروز</button>' +
        '</div>');
  }

  /** روزهای نامعتبر ماه را از فهرست حذف می‌کند */
  function syncJDateDays(box) {
    var y = +$('[data-part=y]', box).value, m = +$('[data-part=m]', box).value;
    var dSel = $('[data-part=d]', box);
    var len = J.monthLength(y, m);
    var cur = +dSel.value;
    var html = '';
    for (var i = 1; i <= len; i++) {
      html += '<option value="' + i + '"' + (i === Math.min(cur, len) ? ' selected' : '') + '>' + J.faDigits(i) + '</option>';
    }
    dSel.innerHTML = html;
  }

  function readJDate(root, name) {
    var box = $('[data-jdate="' + name + '"]', root);
    if (!box) return null;
    return J.jToISO(+$('[data-part=y]', box).value, +$('[data-part=m]', box).value, +$('[data-part=d]', box).value);
  }

  function setJDate(root, name, iso) {
    var box = $('[data-jdate="' + name + '"]', root);
    if (!box) return;
    var j = J.isoToJ(iso);
    $('[data-part=y]', box).value = j.jy;
    $('[data-part=m]', box).value = j.jm;
    syncJDateDays(box);
    $('[data-part=d]', box).value = j.jd;
  }

  /* رویدادهای مشترک انتخاب تاریخ روی کل سند */
  document.addEventListener('change', function (ev) {
    var box = ev.target.closest('.jdate');
    if (box && ev.target.matches('[data-part=y],[data-part=m]')) syncJDateDays(box);
  });

  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-act=jd-today],[data-act=jd-yesterday]');
    if (!btn) return;
    var name = btn.getAttribute('data-target');
    var root = btn.closest('.modal, .view') || document;
    var iso = btn.getAttribute('data-act') === 'jd-today' ? J.todayISO() : J.addDays(J.todayISO(), -1);
    setJDate(root, name, iso);
    $$('.chip', btn.parentNode).forEach(function (c) { c.classList.remove('sel'); });
    btn.classList.add('sel');
  });

  /* ================= قطعه‌های آماده ================= */

  function stat(cls, key, value, unit) {
    return '<div class="stat ' + (cls || '') + '">' +
      '<span class="k">' + esc(key) + '</span>' +
      '<span class="v money">' + value + (unit ? ' <span class="u">' + esc(unit) + '</span>' : '') + '</span>' +
      '</div>';
  }

  function emptyBox(icon, text) {
    return '<div class="empty"><span class="ico">' + icon + '</span>' + esc(text) + '</div>';
  }

  function money(v) { return J.num(v) + ' <span class="u">تومان</span>'; }

  function fcrText(fcr) { return fcr ? J.num(fcr, 2) : '—'; }

  global.UI = {
    $: $, $$: $$, esc: esc, toast: toast,
    modal: modal, closeModal: closeModal, confirmBox: confirmBox,
    jdateHTML: jdateHTML, readJDate: readJDate, setJDate: setJDate, syncJDateDays: syncJDateDays,
    stat: stat, emptyBox: emptyBox, money: money, fcrText: fcrText,
    state: state
  };
})(window);
