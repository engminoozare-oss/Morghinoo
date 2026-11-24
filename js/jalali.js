/* مرغینو — تبدیل و قالب‌بندی تاریخ شمسی
 * الگوریتم تبدیل بر پایه‌ی jalaali-js (MIT) پیاده‌سازی شده است.
 * همه‌ی تاریخ‌ها در حافظه به شکل میلادی «YYYY-MM-DD» ذخیره می‌شوند
 * و فقط هنگام نمایش به شمسی تبدیل می‌گردند.
 */
(function (global) {
  'use strict';

  var BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
                1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

  var MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
                'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

  var WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

  function div(a, b) { return ~~(a / b); }
  function mod(a, b) { return a - ~~(a / b) * b; }

  function jalCal(jy) {
    var bl = BREAKS.length, gy = jy + 621, leapJ = -14, jp = BREAKS[0];
    var jm, jump = 0, leap, leapG, march, n, i;
    if (jy < jp || jy >= BREAKS[bl - 1]) throw new Error('سال شمسی نامعتبر: ' + jy);
    for (i = 1; i < bl; i += 1) {
      jm = BREAKS[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap: leap, gy: gy, march: march };
  }

  function g2d(gy, gm, gd) {
    var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
            div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  }

  function d2g(jdn) {
    var j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    var i = div(mod(j, 1461), 4) * 5 + 308;
    var gd = div(mod(i, 153), 5) + 1;
    var gm = mod(div(i, 153), 12) + 1;
    var gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy: gy, gm: gm, gd: gd };
  }

  function j2d(jy, jm, jd) {
    var r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }

  function d2j(jdn) {
    var gy = d2g(jdn).gy, jy = gy - 621, r = jalCal(jy), jdn1f = g2d(gy, 3, r.march);
    var jd, jm, k = jdn - jdn1f;
    if (k >= 0) {
      if (k <= 185) return { jy: jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    jm = 7 + div(k, 30);
    jd = mod(k, 30) + 1;
    return { jy: jy, jm: jm, jd: jd };
  }

  function isLeap(jy) { return jalCal(jy).leap === 0; }

  function monthLength(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isLeap(jy) ? 30 : 29;
  }

  /* ---------- کمک‌کارهای ISO ---------- */

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function toISO(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function todayISO() { return toISO(new Date()); }

  function parseISO(iso) {
    var p = String(iso || '').split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function isoToJ(iso) {
    var p = String(iso || '').split('-');
    return d2j(g2d(+p[0], +p[1], +p[2]));
  }

  function jToISO(jy, jm, jd) {
    var g = d2g(j2d(jy, jm, jd));
    return g.gy + '-' + pad(g.gm) + '-' + pad(g.gd);
  }

  function addDays(iso, n) {
    var d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }

  /** اختلاف روز بین دو تاریخ ISO (b - a) */
  function diffDays(a, b) {
    var da = parseISO(a), db = parseISO(b);
    return Math.round((db - da) / 86400000);
  }

  /* ---------- ارقام و نمایش ---------- */

  var FA = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

  function faDigits(s) {
    return String(s).replace(/\d/g, function (d) { return FA[+d]; });
  }

  /** ارقام فارسی و عربی را به رقم لاتین برمی‌گرداند تا بشود با آن‌ها حساب کرد */
  function latinDigits(s) {
    return String(s == null ? '' : s)
      .replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 1776; })
      .replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 1632; });
  }

  /**
   * هر متنی را که کاربر در کادر نوشته به عدد تبدیل می‌کند:
   * ارقام فارسی و عربی، جداکننده‌ی هزارگان (٬ ، ,) و علامت اعشار (٫ / .)
   * همگی پذیرفته می‌شوند. اگر عددی در متن نباشد صفر برمی‌گرداند.
   */
  function parseNum(v) {
    var s = latinDigits(v)
      .replace(/[\u066C\u060C,\s\u200c]/g, '')   // جداکننده‌ی هزارگان حذف می‌شود
      .replace(/[\u066B\/]/g, '.')                 // ٫ و / هر دو یعنی اعشار
      .replace(/[^0-9.\-]/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  /** عدد را با جداکننده‌ی هزارگان و ارقام فارسی برمی‌گرداند */
  function num(n, decimals) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    var v = Number(n);
    var s = decimals ? v.toFixed(decimals) : Math.round(v).toString();
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
    return faDigits(parts.join('/'));
  }

  /** مقدار: اگر عدد رُند باشد اعشار نمی‌گیرد (۱۰٬۰۰۰ نه ۱۰٬۰۰۰/۰۰) */
  function qty(n) {
    var v = Number(n) || 0;
    return num(v, v % 1 === 0 ? 0 : 2);
  }

  /** «۱۴ مهر ۱۴۰۴» */
  function fmt(iso) {
    if (!iso) return '—';
    var j = isoToJ(iso);
    return faDigits(j.jd) + ' ' + MONTHS[j.jm - 1] + ' ' + faDigits(j.jy);
  }

  /** «۱۴ مهر» — بدون سال، برای جدول‌های باریک */
  function fmtDay(iso) {
    if (!iso) return '—';
    var j = isoToJ(iso);
    return faDigits(j.jd) + ' ' + MONTHS[j.jm - 1];
  }

  /** «۱۴۰۴/۰۷/۱۴» */
  function fmtShort(iso) {
    if (!iso) return '—';
    var j = isoToJ(iso);
    return faDigits(j.jy + '/' + pad(j.jm) + '/' + pad(j.jd));
  }

  /** «شنبه ۱۴ مهر» */
  function fmtWithDay(iso) {
    if (!iso) return '—';
    var j = isoToJ(iso);
    return WEEKDAYS[parseISO(iso).getDay()] + ' ' + faDigits(j.jd) + ' ' + MONTHS[j.jm - 1];
  }

  function weekday(iso) { return WEEKDAYS[parseISO(iso).getDay()]; }

  /** «امروز» / «دیروز» / تاریخ */
  function relative(iso) {
    var d = diffDays(iso, todayISO());
    if (d === 0) return 'امروز';
    if (d === 1) return 'دیروز';
    if (d === -1) return 'فردا';
    return fmt(iso);
  }

  global.J = {
    monthNames: MONTHS,
    weekdayNames: WEEKDAYS,
    monthLength: monthLength,
    isLeap: isLeap,
    todayISO: todayISO,
    toISO: toISO,
    parseISO: parseISO,
    isoToJ: isoToJ,
    jToISO: jToISO,
    addDays: addDays,
    diffDays: diffDays,
    faDigits: faDigits,
    latinDigits: latinDigits,
    parseNum: parseNum,
    num: num,
    qty: qty,
    fmt: fmt,
    fmtDay: fmtDay,
    fmtShort: fmtShort,
    fmtWithDay: fmtWithDay,
    weekday: weekday,
    relative: relative
  };
})(window);
