/* مرغینو — محاسبات دوره
 *
 * نرخ تبدیل (ضریب تبدیل غذایی) طبق تعریف مرغداری:
 *   ۱) کل دان مصرفی از ابتدای دوره تا تاریخ استعلام  (کیلوگرم)
 *   ۲) تعداد جوجه‌های زنده = تعداد کل گله − کل تلفات تا آن تاریخ
 *   ۳) دان مصرفی هر مرغ = (۱) ÷ (۲)
 *   ۴) نرخ تبدیل = دان مصرفی هر مرغ ÷ میانگین وزن ثبت‌شده (کیلوگرم)
 */
(function (global) {
  'use strict';

  function sum(arr, fn) {
    return arr.reduce(function (a, x) { return a + (Number(fn(x)) || 0); }, 0);
  }

  function upto(list, date) {
    if (!date) return list.slice();
    return list.filter(function (r) { return r.date && r.date <= date; });
  }

  /** آخرین رکورد وزن‌کشی تا تاریخ داده‌شده */
  function latestWeight(cycle, date) {
    var rows = upto(cycle.weights || [], date).slice().sort(function (a, b) {
      return a.date < b.date ? -1 : 1;
    });
    return rows.length ? rows[rows.length - 1] : null;
  }

  /** گزارش کامل وضعیت دوره تا یک تاریخ مشخص (پیش‌فرض: امروز) */
  function report(cycle, date) {
    var J = global.J;
    date = date || J.todayISO();

    var flock = Number(cycle.start.flockCount) || 0;
    var deaths = sum(upto(cycle.mortality || [], date), function (r) { return r.count; });
    var alive = Math.max(0, flock - deaths);
    var feedKg = sum(upto(cycle.feed || [], date), function (r) { return r.kg; });

    var w = latestWeight(cycle, date);
    var avgWeightG = w ? Number(w.avgWeight) || 0 : Number(cycle.start.initialWeight) || 0;
    var avgWeightKg = avgWeightG / 1000;

    var feedPerBirdKg = alive > 0 ? feedKg / alive : 0;
    var fcr = (alive > 0 && avgWeightKg > 0) ? feedPerBirdKg / avgWeightKg : null;

    var day = cycle.start.entryDate ? J.diffDays(cycle.start.entryDate, date) + 1 : 0;
    var duration = Number(cycle.start.durationDays) || 90;

    /* ---- هزینه‌ها ---- */
    var expenses = cycle.expenses || [];
    var totalCost = sum(expenses, function (e) { return e.total; });
    var byCat = {};
    global.Store.CATEGORIES.forEach(function (c) { byCat[c.id] = { qty: 0, total: 0, count: 0 }; });
    expenses.forEach(function (e) {
      if (!byCat[e.cat]) byCat[e.cat] = { qty: 0, total: 0, count: 0 };
      byCat[e.cat].qty += Number(e.qty) || 0;
      byCat[e.cat].total += Number(e.total) || 0;
      byCat[e.cat].count += 1;
    });

    /* ---- فروش و سود ---- */
    var sale = cycle.sale || {};
    var saleBirds = (sale.soldCount === null || sale.soldCount === undefined || sale.soldCount === '')
      ? alive : Number(sale.soldCount) || 0;
    var saleWeightKg = saleBirds * avgWeightKg;
    var pricePerKg = Number(sale.pricePerKg) || 0;
    var extraIncome = Number(sale.extraIncome) || 0;
    var income = saleWeightKg * pricePerKg + extraIncome;
    var profit = income - totalCost;

    return {
      date: date,
      day: day,
      duration: duration,
      remainingDays: Math.max(0, duration - day),
      progress: duration > 0 ? Math.min(100, Math.max(0, (day / duration) * 100)) : 0,

      flock: flock,
      deaths: deaths,
      alive: alive,
      mortalityPct: flock > 0 ? (deaths / flock) * 100 : 0,

      feedKg: feedKg,
      feedPerBirdKg: feedPerBirdKg,
      feedPerBirdG: feedPerBirdKg * 1000,

      avgWeightG: avgWeightG,
      avgWeightKg: avgWeightKg,
      weightDate: w ? w.date : cycle.start.entryDate,
      hasWeighing: !!w,
      fcr: fcr,

      totalCost: totalCost,
      byCat: byCat,
      costPerBird: alive > 0 ? totalCost / alive : 0,
      costPerKg: saleWeightKg > 0 ? totalCost / saleWeightKg : 0,

      saleBirds: saleBirds,
      saleWeightKg: saleWeightKg,
      pricePerKg: pricePerKg,
      extraIncome: extraIncome,
      income: income,
      profit: profit
    };
  }

  /** تاریخ وزن‌کشی بعدی: هفت روز پس از آخرین وزن‌کشی (یا پس از ورود جوجه) */
  function nextWeighing(cycle) {
    var J = global.J;
    var rows = (cycle.weights || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var base = rows.length ? rows[rows.length - 1].date : cycle.start.entryDate;
    return base ? J.addDays(base, 7) : null;
  }

  /** روند وزن هفتگی همراه با نرخ تبدیل همان تاریخ */
  function weightTrend(cycle) {
    var rows = (cycle.weights || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return rows.map(function (r, i) {
      var rep = report(cycle, r.date);
      var prev = i > 0 ? Number(rows[i - 1].avgWeight) || 0 : Number(cycle.start.initialWeight) || 0;
      return {
        id: r.id,
        date: r.date,
        week: global.J.diffDays(cycle.start.entryDate, r.date) / 7,
        avgWeight: Number(r.avgWeight) || 0,
        gain: (Number(r.avgWeight) || 0) - prev,
        fcr: rep.fcr,
        sample: r.sample,
        note: r.note
      };
    });
  }

  /** میانگین دان مصرفی روزانه در N روز گذشته */
  function recentFeedAvg(cycle, days) {
    var J = global.J, today = J.todayISO();
    var from = J.addDays(today, -(days || 7));
    var rows = (cycle.feed || []).filter(function (r) { return r.date > from && r.date <= today; });
    return rows.length ? sum(rows, function (r) { return r.kg; }) / rows.length : 0;
  }

  global.Calc = {
    report: report,
    nextWeighing: nextWeighing,
    weightTrend: weightTrend,
    recentFeedAvg: recentFeedAvg,
    latestWeight: latestWeight,
    sum: sum
  };
})(window);
