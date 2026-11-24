/* مرغینو — ادغام داده‌ی دو دستگاه
 *
 * همین فایل هم در مرورگر و هم در سرور اجرا می‌شود تا قانون ادغام در هر دو
 * طرف دقیقاً یکی باشد.
 *
 * قانون: هر رکورد یک شناسه و یک زمان آخرین تغییر (updatedAt) دارد و هنگام
 * ادغام، تازه‌ترین نسخه برنده است. حذف هم یک تغییر است (deleted: true)،
 * نه پاک کردن واقعی؛ وگرنه رکوردی که مدیر حذف کرده از گوشی کارگر دوباره
 * برمی‌گشت.
 *
 * تلفات و دان روزانه شناسه‌ی ثابت بر پایه‌ی تاریخ دارند ("m-2026-11-24")،
 * برای همین اگر کارگر و مدیر هر دو برای یک روز ثبت کنند، دو رکورد تکراری
 * ساخته نمی‌شود؛ همان یکی به‌روز می‌شود.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Merge = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LISTS = ['expenses', 'mortality', 'feed', 'weights', 'vaccines'];
  var OBJECTS = ['start', 'sale', 'summary'];

  function ts(x) { return Number(x && x.updatedAt) || 0; }

  /** شناسه‌ی ثابت رکوردهای روزانه، تا دو دستگاه برای یک روز دو رکورد نسازند */
  function dailyId(list, date) {
    return (list === 'mortality' ? 'm-' : 'f-') + date;
  }

  /** تازه‌ترین نسخه‌ی هر رکورد را نگه می‌دارد */
  function mergeList(a, b) {
    var byId = {};
    [a || [], b || []].forEach(function (list) {
      list.forEach(function (rec) {
        if (!rec || !rec.id) return;
        var cur = byId[rec.id];
        if (!cur || ts(rec) > ts(cur)) byId[rec.id] = rec;
      });
    });
    return Object.keys(byId).map(function (k) { return byId[k]; });
  }

  function mergeCycle(a, b) {
    if (!a) return b;
    if (!b) return a;

    // فیلدهای ساده‌ی خود دوره (نام، وضعیت) از تازه‌ترین طرف می‌آیند
    var base = ts(a) >= ts(b) ? a : b;
    var out = {
      id: base.id,
      name: base.name,
      status: base.status,
      createdAt: a.createdAt || b.createdAt,
      updatedAt: Math.max(ts(a), ts(b))
    };

    OBJECTS.forEach(function (key) {
      var x = a[key], y = b[key];
      out[key] = ts(x) >= ts(y) ? (x || y) : y;
    });

    LISTS.forEach(function (key) {
      out[key] = mergeList(a[key], b[key]);
    });

    return out;
  }

  /** دو مجموعه‌ی دوره را ادغام می‌کند */
  function mergeCycles(a, b) {
    var byId = {};
    (a || []).forEach(function (c) { if (c && c.id) byId[c.id] = c; });
    (b || []).forEach(function (c) {
      if (!c || !c.id) return;
      byId[c.id] = byId[c.id] ? mergeCycle(byId[c.id], c) : c;
    });
    return Object.keys(byId).map(function (k) { return byId[k]; });
  }

  /** رکوردهای حذف‌شده را برای نمایش کنار می‌گذارد */
  function visible(list) {
    return (list || []).filter(function (r) { return r && !r.deleted; });
  }

  /** تازه‌ترین زمان تغییر در یک مجموعه‌ی دوره */
  function latestStamp(cycles) {
    var max = 0;
    (cycles || []).forEach(function (c) {
      max = Math.max(max, ts(c));
      OBJECTS.forEach(function (k) { max = Math.max(max, ts(c[k])); });
      LISTS.forEach(function (k) {
        (c[k] || []).forEach(function (r) { max = Math.max(max, ts(r)); });
      });
    });
    return max;
  }

  /** فقط دوره‌هایی که بعد از زمان داده‌شده تغییر کرده‌اند (برای کم کردن ترافیک) */
  function changedSince(cycles, since) {
    since = Number(since) || 0;
    if (!since) return cycles || [];
    return (cycles || []).filter(function (c) { return latestStamp([c]) > since; });
  }

  return {
    LISTS: LISTS,
    OBJECTS: OBJECTS,
    dailyId: dailyId,
    mergeList: mergeList,
    mergeCycle: mergeCycle,
    mergeCycles: mergeCycles,
    visible: visible,
    latestStamp: latestStamp,
    changedSince: changedSince
  };
});
