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
    fit(wrap);
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

  /* ================= کادرهای عددی ================= */
  /* کاربر می‌تواند با کیبورد فارسی یا انگلیسی عدد بزند؛ هر چه بنویسد با
     ارقام فارسی و جداکننده‌ی سه‌رقمی نشان داده می‌شود (۱۸۰٬۰۰۰٬۰۰۰).
     مکان‌نما هم سر جای خودش می‌ماند تا وسط عدد هم بشود ویرایش کرد. */

  /* برای جابه‌جایی مکان‌نما، رقم‌ها و علامت اعشار «معنادار» حساب می‌شوند و
     جداکننده‌ی هزارگان نه؛ چون خودِ برنامه آن را می‌گذارد و برمی‌دارد. */
  var SIG_TYPED = /[0-9۰-۹٠-٩.\u066B\/]/;   // آنچه کاربر نوشته
  var SIG_SHOWN = /[0-9۰-۹\/]/;              // آنچه نشان داده می‌شود

  /** متن خام کاربر را به شکل نمایشی درمی‌آورد. mode: dec | int | pin */
  function formatNum(raw, mode) {
    var s = J.latinDigits(raw)
      .replace(/[\u066C\u060C,\s\u200c]/g, '')  // جداکننده‌های هزارگان
      .replace(/[\u066B\/]/g, '.')                // علامت اعشار
      .replace(/[^0-9.]/g, '');

    if (mode === 'pin') return J.faDigits(s.replace(/\./g, '').slice(0, 4));
    if (mode !== 'dec') s = s.split('.')[0];   // ۱۰۰۰۰٫۵ در کادر تعدادی یعنی ۱۰۰۰۰

    var dot = s.indexOf('.');
    var intPart = dot < 0 ? s : s.slice(0, dot);
    var frac = dot < 0 ? '' : s.slice(dot + 1).replace(/\./g, '');

    intPart = intPart.replace(/^0+(?=\d)/, '');     // صفرهای اضافه‌ی ابتدای عدد
    if (!intPart && dot >= 0) intPart = '0';

    var out = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
    if (dot >= 0) out += '/' + frac;
    return J.faDigits(out);
  }

  /** چند کاراکتر معنادار پس از مکان‌نما مانده است */
  function sigAfter(str, pos) {
    var n = 0;
    for (var i = pos; i < str.length; i++) {
      if (SIG_TYPED.test(str.charAt(i))) n++;
    }
    return n;
  }

  /** جای مکان‌نما طوری که همین تعداد کاراکتر معنادار جلویش بماند */
  function caretWithSigAfter(str, count) {
    if (count <= 0) return str.length;
    var n = 0;
    for (var i = str.length - 1; i >= 0; i--) {
      if (SIG_SHOWN.test(str.charAt(i))) {
        n++;
        if (n === count) return i;
      }
    }
    return 0;
  }

  function reformat(el) {
    var mode = el.getAttribute('data-num') || 'dec';
    var before = el.value;
    var pos = el.selectionStart;
    var after = formatNum(before, mode);
    if (after === before) return;
    var keep = sigAfter(before, pos == null ? before.length : pos);
    el.value = after;
    if (pos != null) {
      var np = caretWithSigAfter(after, keep);
      try { el.setSelectionRange(np, np); } catch (e) {}
    }
  }

  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el && el.getAttribute && el.getAttribute('data-num')) reformat(el);
  });

  /** ساخت کادر عددی. opts: {mode, placeholder, extra} */
  function numInput(id, value, opts) {
    opts = opts || {};
    var mode = opts.mode || 'dec';
    var shown = (value === '' || value === null || value === undefined)
      ? '' : formatNum(String(value), mode);
    return '<input type="text" id="' + id + '" data-num="' + mode + '"' +
      ' inputmode="' + (mode === 'dec' ? 'decimal' : 'numeric') + '"' +
      ' value="' + esc(shown) + '"' +
      (opts.placeholder ? ' placeholder="' + esc(J.faDigits(opts.placeholder)) + '"' : '') +
      (mode === 'pin' ? ' maxlength="4"' : '') +
      ' autocomplete="off" enterkeyhint="done"' + (opts.extra || '') + '>';
  }

  /** مقدار عددی را در کادر می‌نشاند (برای دکمه‌های + و −) */
  function setNum(el, value) {
    el.value = formatNum(String(value), el.getAttribute('data-num') || 'dec');
  }

  /** عدد داخل کادر را برمی‌گرداند */
  function getNum(root, sel) {
    var el = typeof sel === 'string' ? $(sel, root) : sel;
    return el ? J.parseNum(el.value) : 0;
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
      '<span class="v money" data-fit>' + value +
        (unit ? ' <span class="u">' + esc(unit) + '</span>' : '') + '</span>' +
      '</div>';
  }

  /* ---------- جا شدن عددهای بلند ----------
     عددهای تومانی گاهی ۱۰ رقمی می‌شوند. هر عنصری که data-fit داشته باشد،
     اگر پهن‌تر از جای خودش باشد قلمش کمی کوچک می‌شود تا جا بیفتد؛
     این‌طور هیچ‌وقت صفحه افقی نمی‌لغزد و عدد هم کامل خوانده می‌شود. */

  function fitOne(el) {
    el.style.fontSize = '';
    var size = parseFloat(window.getComputedStyle(el).fontSize) || 16;
    var min = Math.max(11, size * 0.45);
    var guard = 0;
    while (el.scrollWidth > el.clientWidth + 1 && size > min && guard++ < 60) {
      size -= 1;
      el.style.fontSize = size + 'px';
    }
  }

  function fit(root) {
    $$('[data-fit]', root || document).forEach(fitOne);
  }

  var fitTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(function () { fit(); }, 120);
  });

  function emptyBox(icon, text) {
    return '<div class="empty"><span class="ico">' + icon + '</span>' + esc(text) + '</div>';
  }

  function money(v) { return J.num(v) + ' <span class="u">تومان</span>'; }

  function fcrText(fcr) { return fcr ? J.num(fcr, 2) : '—'; }

  global.UI = {
    $: $, $$: $$, esc: esc, toast: toast,
    modal: modal, closeModal: closeModal, confirmBox: confirmBox,
    jdateHTML: jdateHTML, readJDate: readJDate, setJDate: setJDate, syncJDateDays: syncJDateDays,
    numInput: numInput, setNum: setNum, getNum: getNum, formatNum: formatNum,
    stat: stat, emptyBox: emptyBox, money: money, fcrText: fcrText, fit: fit,
    state: state
  };
})(window);
