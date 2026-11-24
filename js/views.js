/* مرغینو — سه تب اصلی برنامه */
(function (global) {
  'use strict';

  var J = global.J, Store = global.Store, Calc = global.Calc, Notify = global.Notify, UI = global.UI;
  var esc = UI.esc, stat = UI.stat, money = UI.money;

  /* ================= تب ۲: گزارش وضعیت ================= */

  function reminderCards(cycle, isManager) {
    var list = Notify.pending(cycle, isManager ? 'manager' : 'worker');
    if (!list.length) {
      return '<div class="alert ok"><span class="ico">✅</span><div class="body">' +
        '<div class="t">همه‌چیز به‌روز است</div>' +
        '<div class="s">ثبت‌های امروز انجام شده است.</div></div></div>';
    }
    return list.map(function (r) {
      return '<div class="alert ' + r.level + '" data-act="reminder" data-target="' + r.action + '"' +
        (r.id ? ' data-id="' + r.id + '"' : '') + '>' +
        '<span class="ico">' + r.icon + '</span>' +
        '<div class="body"><div class="t">' + esc(r.title) + '</div>' +
        '<div class="s">' + esc(r.body) + '</div></div>' +
        '<button class="btn sm">' + esc(r.btn || 'ثبت') + '</button></div>';
    }).join('');
  }

  function bigActions(cycle) {
    var today = J.todayISO();
    var m = Store.list(cycle, 'mortality').filter(function (r) { return r.date === today; })[0];
    var f = Store.list(cycle, 'feed').filter(function (r) { return r.date === today; })[0];
    var next = Calc.nextWeighing(cycle);
    var weighDue = next && next <= today;

    function box(act, icon, label, done, text) {
      return '<button class="big-action ' + (done ? 'done' : 'todo') + '" data-act="' + act + '">' +
        '<span class="ico">' + icon + '</span>' +
        '<span class="lbl">' + esc(label) + '</span>' +
        '<span class="st ' + (done ? 'pos' : 'muted') + '">' + text + '</span></button>';
    }

    return '<div class="big-actions">' +
      box('mortality', '🪶', 'تلفات امروز', !!m,
          m ? '✔ ' + J.num(m.count) + ' قطعه' : 'ثبت نشده') +
      box('feed', '🌾', 'دان امروز', !!f,
          f ? '✔ ' + J.num(f.kg) + ' کیلو' : 'ثبت نشده') +
      box('weight', '⚖️', 'وزن‌کشی', !weighDue,
          weighDue ? 'امروز نوبت است' : (next ? J.fmtShort(next) : '—')) +
      '</div>';
  }

  function vaccineCard(cycle, isManager) {
    var today = J.todayISO();
    var rows = Store.list(cycle, 'vaccines').slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var body;
    if (!rows.length) {
      body = UI.emptyBox('💉', isManager ? 'هنوز واکسنی تعریف نشده است.' : 'مدیر هنوز واکسنی تعریف نکرده است.');
    } else {
      body = '<div class="list">' + rows.map(function (v) {
        var d = J.diffDays(today, v.date);
        var badge = v.done ? '<span class="badge ok">انجام شد</span>'
          : d === 1 ? '<span class="badge bad">فردا</span>'
          : d === 0 ? '<span class="badge bad">امروز</span>'
          : d < 0 ? '<span class="badge bad">عقب‌افتاده</span>'
          : '<span class="badge">' + J.faDigits(d) + ' روز مانده</span>';
        return '<div class="item"><span class="ico">💉</span>' +
          '<div class="body"><div class="t">' + esc(v.name) + '</div>' +
          '<div class="s">' + J.fmt(v.date) + (v.note ? ' • ' + esc(v.note) : '') + '</div></div>' +
          badge +
          (v.done ? '' : '<button class="btn sm ok" data-act="vaccine-done" data-id="' + v.id + '">✔</button>') +
          (isManager ? '<button class="btn sm ghost" data-act="vaccine-edit" data-id="' + v.id + '">✎</button>' : '') +
          '</div>';
      }).join('') + '</div>';
    }
    return '<div class="card"><div class="card-head"><h2>💉 برنامه‌ی واکسن</h2>' +
      (isManager ? '<button class="btn sm" data-act="vaccine-add">+ واکسن</button>' : '') +
      '</div>' + body + '</div>';
  }

  function fcrCard(cycle) {
    var date = UI.state.fcrDate || J.todayISO();
    var r = Calc.report(cycle, date);
    return '<div class="card">' +
      '<div class="card-head"><h2>🧮 نرخ تبدیل</h2>' +
      '<button class="btn sm ghost" data-act="fcr-date">📅 ' + J.fmtShort(date) + '</button></div>' +
      '<div class="stat hero"><span class="k">نرخ تبدیل تا این تاریخ</span>' +
      '<span class="v">' + UI.fcrText(r.fcr) + '</span></div>' +
      '<div class="stat-grid three" style="margin-top:10px">' +
        stat('info', 'دان مصرفی', J.num(r.feedKg, 1), 'کیلو') +
        stat('info', 'جوجه‌ی زنده', J.num(r.alive), 'قطعه') +
        stat('info', 'میانگین وزن', J.num(r.avgWeightG), 'گرم') +
      '</div>' +
      '<p class="tiny muted" style="margin:10px 2px 0">' +
        'دان هر مرغ = ' + J.num(r.feedKg, 1) + ' ÷ ' + J.num(r.alive) + ' = <b>' + J.num(r.feedPerBirdKg, 2) + '</b> کیلو<br>' +
        'نرخ تبدیل = ' + J.num(r.feedPerBirdKg, 2) + ' ÷ ' + J.num(r.avgWeightKg, 3) + ' = <b>' + UI.fcrText(r.fcr) + '</b>' +
        (r.hasWeighing ? '' : '<br>⚠️ هنوز وزن‌کشی ثبت نشده؛ فعلاً وزن اولیه‌ی جوجه استفاده شده است.') +
      '</p></div>';
  }

  /* جدول‌ها باید کامل در عرض گوشی جا شوند، پس تاریخ و روزِ هفته در یک
     خانه‌ی دوخطی ادغام شده‌اند و به‌جای ستون دکمه، کل سطر لمسی است. */

  function none() { return '<span class="none">—</span>'; }

  function dailyHistory(cycle) {
    var today = J.todayISO();
    var rows = [], i;
    for (i = 0; i < 10; i++) {
      var d = J.addDays(today, -i);
      if (cycle.start.entryDate && d < cycle.start.entryDate) break;
      var m = Store.list(cycle, 'mortality').filter(function (r) { return r.date === d; })[0];
      var f = Store.list(cycle, 'feed').filter(function (r) { return r.date === d; })[0];
      var head = i === 0 ? 'امروز' : (i === 1 ? 'دیروز' : J.weekday(d));
      rows.push('<tr class="tap" data-act="day-edit" data-date="' + d + '">' +
        '<td class="when"><b>' + head + '</b><span>' + J.fmtDay(d) + '</span></td>' +
        '<td class="n">' + (m ? J.num(m.count) : none()) + '</td>' +
        '<td class="n">' + (f ? J.num(f.kg, 1) : none()) + '</td>' +
        '<td class="edit">✎</td></tr>');
    }
    return '<div class="card"><h2>📆 ده روز اخیر</h2><div class="table-wrap">' +
      '<table class="rtable"><thead><tr>' +
      '<th>روز</th><th>🪶 تلفات</th><th>🌾 دان (کیلو)</th><th></th>' +
      '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' +
      '<p class="tiny muted" style="margin:8px 2px 0">برای اصلاح هر روز، روی سطرش بزنید.</p></div>';
  }

  function weightTable(cycle, showFcr) {
    var rows = Calc.weightTrend(cycle);
    if (!rows.length) {
      return '<div class="card"><h2>⚖️ وزن‌کشی هفتگی</h2>' +
        UI.emptyBox('⚖️', 'هنوز وزن‌کشی ثبت نشده است.') + '</div>';
    }
    return '<div class="card"><h2>⚖️ وزن‌کشی هفتگی</h2><div class="table-wrap">' +
      '<table class="rtable"><thead><tr>' +
        '<th>هفته</th><th>وزن (گرم)</th><th>رشد</th>' +
        (showFcr ? '<th>نرخ تبدیل</th>' : '') + '<th></th>' +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr class="tap" data-act="weight-edit" data-id="' + r.id + '">' +
          '<td class="when"><b>هفته ' + J.num(Math.max(1, Math.round(r.week))) + '</b>' +
            '<span>' + J.fmtDay(r.date) + '</span></td>' +
          '<td class="n big">' + J.num(r.avgWeight) + '</td>' +
          '<td class="n ' + (r.gain >= 0 ? 'pos' : 'neg') + '">' +
            (r.gain >= 0 ? '+' : '−') + J.num(Math.abs(r.gain)) + '</td>' +
          (showFcr ? '<td class="n">' + UI.fcrText(r.fcr) + '</td>' : '') +
          '<td class="edit">✎</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  function cycleInfoCard(cycle, isManager) {
    var s = cycle.start;
    return '<div class="card"><div class="card-head"><h2>🐣 مشخصات دوره</h2>' +
      (isManager ? '<button class="btn sm ghost" data-act="cycle-edit">✎ ویرایش</button>' : '') + '</div>' +
      '<div class="list">' +
      row('📅', 'تاریخ ورود جوجه', J.fmt(s.entryDate)) +
      row('🧬', 'نژاد جوجه', esc(s.breed || '—')) +
      row('🏭', 'شرکت جوجه', esc(s.company || '—')) +
      row('⚖️', 'وزن اولیه', J.num(s.initialWeight) + ' گرم') +
      row('🐥', 'تعداد گله', J.num(s.flockCount) + ' قطعه') +
      row('⏳', 'طول دوره', J.num(s.durationDays) + ' روز') +
      '</div></div>';
  }

  function row(ico, title, value) {
    return '<div class="item"><span class="ico">' + ico + '</span>' +
      '<div class="body"><div class="s">' + esc(title) + '</div></div>' +
      '<span class="val money">' + value + '</span></div>';
  }

  /** «۳ دقیقه پیش» */
  function relTime(t) {
    if (!t) return 'هنوز نه';
    var sec = Math.round((Date.now() - t) / 1000);
    if (sec < 60) return 'همین الان';
    var min = Math.round(sec / 60);
    if (min < 60) return J.num(min) + ' دقیقه پیش';
    var hr = Math.round(min / 60);
    if (hr < 24) return J.num(hr) + ' ساعت پیش';
    return J.num(Math.round(hr / 24)) + ' روز پیش';
  }

  /**
   * داشبورد مدیر: ثبت‌های امروزِ کارگر.
   * فقط وقتی نشان داده می‌شود که همگام‌سازی روشن باشد، چون بدون سرور
   * اطلاعات کارگر اصلاً به این گوشی نمی‌رسد و نشان دادنش گمراه‌کننده است.
   */
  function workerTodayCard(cycle) {
    var Sync = global.Sync;
    if (!Sync || !Sync.isOn()) return '';

    var today = J.todayISO();
    var m = Store.list(cycle, 'mortality').filter(function (r) { return r.date === today; })[0];
    var f = Store.list(cycle, 'feed').filter(function (r) { return r.date === today; })[0];
    var st = Sync.state;

    function box(icon, label, rec, value, unit) {
      return '<div class="wt-box ' + (rec ? 'done' : 'todo') + '">' +
        '<span class="ico">' + icon + '</span>' +
        '<span class="k">' + esc(label) + '</span>' +
        (rec
          ? '<span class="v" data-fit>' + value + ' <span class="u">' + esc(unit) + '</span></span>' +
            '<span class="when">ثبت ' + relTime(rec.updatedAt) + '</span>'
          : '<span class="v none">ثبت نشده</span><span class="when">منتظر کارگر</span>') +
        '</div>';
    }

    var line = st.status === 'ok' ? 'آخرین به‌روزرسانی ' + relTime(st.lastOk)
      : st.status === 'syncing' ? 'در حال گرفتن تازه‌ترین گزارش…'
      : st.status === 'offline' ? '📴 اینترنت وصل نیست؛ آخرین گزارش ' + relTime(st.lastOk)
      : st.message || 'همگام‌سازی ناموفق';

    return '<div class="card worker-card">' +
      '<div class="card-head"><h2>📡 گزارش امروز کارگر</h2>' +
        '<button class="btn sm ghost" data-act="sync">🔄</button></div>' +
      '<div class="wt-grid">' +
        box('🪶', 'تلفات امروز', m, m ? J.num(m.count) : '', 'قطعه') +
        box('🌾', 'دان امروز', f, f ? J.num(f.kg, 1) : '', 'کیلو') +
      '</div>' +
      '<p class="tiny muted center" style="margin:10px 0 0">' + esc(line) + '</p>' +
      '</div>';
  }

  function statusCard(cycle, isManager) {
    var r = Calc.report(cycle);
    var mortalityCls = r.mortalityPct > 8 ? 'bad' : (r.mortalityPct > 4 ? 'warn' : 'ok');

    // مدیر نرخ تبدیل را در صدر می‌بیند؛ برای کارگر تعداد جوجه‌ی زنده مهم‌تر و ساده‌تر است.
    var body = isManager
      ? '<div class="stat-grid">' +
          stat('hero', 'نرخ تبدیل', UI.fcrText(r.fcr)) +
          stat('ok', 'جوجه‌ی زنده', J.num(r.alive), 'قطعه') +
          stat(mortalityCls, 'کل تلفات', J.num(r.deaths), '(' + J.num(r.mortalityPct, 1) + '٪)') +
          stat('info', 'میانگین وزن', J.num(r.avgWeightG), 'گرم') +
          stat('info', 'کل دان مصرفی', J.num(r.feedKg, 1), 'کیلو') +
        '</div>'
      : '<div class="stat-grid">' + stat('hero ok', 'جوجه‌ی زنده', J.num(r.alive), 'قطعه') + '</div>' +
        '<div class="stat-grid three" style="margin-top:10px">' +
          stat(mortalityCls, 'کل تلفات', J.num(r.deaths), 'قطعه') +
          stat('info', 'میانگین وزن', J.num(r.avgWeightG), 'گرم') +
          stat('info', 'کل دان', J.num(r.feedKg, 1), 'کیلو') +
        '</div>';

    return '<div class="card">' +
        '<div class="card-head"><h2>📊 وضعیت امروز</h2>' +
        '<span class="badge">روز ' + J.num(r.day) + ' از ' + J.num(r.duration) + '</span></div>' +
        body +
        '<div class="progress"><i style="width:' + r.progress.toFixed(1) + '%"></i></div>' +
        '<p class="tiny muted center" style="margin:6px 0 0">' +
          (r.remainingDays > 0 ? J.num(r.remainingDays) + ' روز تا پایان دوره' : 'دوره به پایان رسیده است') +
        '</p>' +
      '</div>';
  }

  function renderReport(cycle, isManager) {
    // صفحه‌ی کارگر عمداً کوتاه است: یادآور، سه دکمه‌ی ثبت، وضعیت امروز و
    // سابقه‌ی ثبت‌های خودش. نرخ تبدیل، برنامه‌ی واکسن و مشخصات دوره کار مدیر است.
    if (!isManager) {
      return reminderCards(cycle, false) +
        bigActions(cycle) +
        statusCard(cycle, false) +
        dailyHistory(cycle) +
        weightTable(cycle, false);
    }

    return workerTodayCard(cycle) +
      reminderCards(cycle, true) +
      bigActions(cycle) +
      statusCard(cycle, true) +
      fcrCard(cycle) +
      vaccineCard(cycle, true) +
      dailyHistory(cycle) +
      weightTable(cycle, true) +
      cycleInfoCard(cycle, true);
  }

  /* ================= کارت مالی ================= */

  /**
   * خلاصه‌ی پول دوره. عددهای تومانی ۹ تا ۱۱ رقمی‌اند، پس هر کدام یک سطر
   * کامل می‌گیرند و نوار زیرشان اندازه‌ها را کنار هم نشان می‌دهد؛
   * این‌طور هیچ عددی از لبه‌ی صفحه بیرون نمی‌زند.
   */
  function moneyCard(cycle, r) {
    var hasIncome = r.income > 0;
    var base = Math.max(r.income, r.totalCost, 1);

    function bar(cls, icon, label, value, width) {
      return '<div class="ms-row ' + cls + '">' +
        '<div class="top"><span class="ico">' + icon + '</span>' +
        '<span class="lbl">' + esc(label) + '</span>' +
        '<span class="v" data-fit>' + J.num(value) + '<span class="u">تومان</span></span></div>' +
        '<div class="bar"><i style="width:' + width.toFixed(1) + '%"></i></div></div>';
    }

    var hero = hasIncome
      ? '<span class="ms-hero ' + (r.profit >= 0 ? 'pos' : 'neg') + '" data-fit>' +
          (r.profit < 0 ? '−' : '') + J.num(Math.abs(r.profit)) +
          '<span class="u">تومان</span></span>' +
        '<p class="ms-sub">' + (r.profit >= 0
          ? 'به ازای هر جوجه ' + J.num(r.alive > 0 ? r.profit / r.alive : 0) + ' تومان'
          : 'فعلاً ' + J.num(Math.abs(r.profit)) + ' تومان عقب هستید') + '</p>'
      : '<span class="ms-hero idle" data-fit>هنوز حساب نشده</span>' +
        '<p class="ms-sub">فی روز مرغ را وارد کنید تا سود دوره حساب شود.</p>';

    return '<div class="card money-card">' +
      '<div class="ms-head"><span class="k">🧮 سود خالص دوره</span>' +
        (hasIncome
          ? '<span class="badge ' + (r.profit >= 0 ? 'ok' : 'bad') + '">' +
            (r.profit >= 0 ? 'سودده' : 'زیان‌ده') + '</span>'
          : '<button class="btn sm" data-act="sale-edit">💵 ثبت فی</button>') +
      '</div>' +
      hero +
      '<div class="ms-rows">' +
        (hasIncome ? bar('income', '🧾', 'کل فروش', r.income, (r.income / base) * 100) : '') +
        bar('cost', '💸', 'کل هزینه', r.totalCost, (r.totalCost / base) * 100) +
      '</div>' +
      (hasIncome
        ? '<div class="ms-foot">' +
            '<div class="box"><span class="k">هزینه‌ی هر جوجه</span>' +
            '<span class="v" data-fit>' + J.num(r.costPerBird) +
            '<span class="u"> تومان</span></span></div>' +
            '<div class="box"><span class="k">تمام‌شده‌ی هر کیلو</span>' +
            '<span class="v" data-fit>' + J.num(r.costPerKg) +
            '<span class="u"> تومان</span></span></div>' +
          '</div>'
        : '') +
      '</div>';
  }

  /* ================= تب ۱: هزینه و درآمد ================= */

  function renderMoney(cycle, isManager) {
    if (!isManager) {
      return '<div class="card center" style="padding:36px 16px">' +
        '<div style="font-size:64px">🔒</div>' +
        '<h2 style="justify-content:center">فقط مدیر</h2>' +
        '<p class="muted">بخش هزینه‌ها و درآمد فقط برای مدیر مرغداری باز می‌شود.</p>' +
        '<button class="btn block" data-act="switch-user" style="margin-top:12px">ورود به عنوان مدیر</button>' +
        '</div>';
    }

    var r = Calc.report(cycle);

    // اگر هزینه‌ای با دسته‌ی قدیمی مانده باشد، آخر فهرست نشان داده می‌شود
    // تا مبلغش بی‌صدا از چشم پنهان نماند.
    var known = Store.CATEGORIES.map(function (c) { return c.id; });
    var extra = [];
    Store.list(cycle, 'expenses').forEach(function (e) {
      if (known.indexOf(e.cat) < 0 && extra.indexOf(e.cat) < 0) extra.push(e.cat);
    });

    var cats = Store.CATEGORIES.concat(extra.map(Store.category)).map(function (c) {
      var d = r.byCat[c.id] || { qty: 0, total: 0, count: 0 };
      var share = r.totalCost > 0 ? (d.total / r.totalCost) * 100 : 0;
      return '<div class="item tap" data-act="cat-open" data-cat="' + c.id + '">' +
        '<span class="ico">' + c.icon + '</span>' +
        '<div class="body"><div class="t">' + esc(c.label) + '</div>' +
        '<div class="s">' + (d.count ? J.qty(d.qty) + ' ' + esc(c.unit) + ' • ' + J.num(share, 1) + '٪ هزینه'
                                     : 'ثبت نشده') + '</div></div>' +
        // دسته‌ی خالی «۰» نشان ندهد؛ یک خط تیره‌ی کم‌رنگ خواناتر است
        '<span class="val money" data-fit>' +
          (d.count ? J.num(d.total) : '<span class="muted">—</span>') + '</span></div>';
    }).join('');

    var sale = cycle.sale || {};

    return moneyCard(cycle, r) +

      '<button class="btn block" data-act="expense-add" style="margin:12px 0">➕ ثبت هزینه‌ی جدید</button>' +

      '<div class="card"><div class="card-head"><h2>💸 هزینه‌ها</h2>' +
        '<span class="badge">جمع: ' + J.num(r.totalCost) + ' تومان</span></div>' +
        '<div class="list">' + cats + '</div></div>' +

      '<div class="card"><div class="card-head"><h2>🐔 فروش مرغ</h2>' +
        '<button class="btn sm" data-act="sale-edit">✎ ویرایش</button></div>' +
        '<div class="list">' +
          row('💵', 'فی روز مرغ (هر کیلو)', J.num(r.pricePerKg) + ' تومان') +
          row('🐥', 'تعداد مرغ آماده‌ی فروش', J.num(r.saleBirds) + ' قطعه') +
          row('⚖️', 'میانگین وزن هر مرغ', J.num(r.avgWeightG) + ' گرم') +
          row('🏋️', 'وزن کل مرغ‌ها', J.num(r.saleWeightKg, 1) + ' کیلو') +
          (r.extraIncome ? row('➕', 'درآمد دیگر (کود و…)', J.num(r.extraIncome) + ' تومان') : '') +
          row('🧾', 'مبلغ کل فروش', '<b>' + J.num(r.income) + '</b> تومان') +
        '</div>' +
        '<p class="tiny muted" style="margin:8px 2px 0">' +
          'وزن کل = ' + J.num(r.saleBirds) + ' قطعه × ' + J.num(r.avgWeightKg, 3) + ' کیلو = ' + J.num(r.saleWeightKg, 1) + ' کیلو' +
        '</p>' +
      '</div>';
  }

  /* ================= تب ۳: جمع‌بندی ================= */

  function renderSummary(cycle, isManager) {
    var r = Calc.report(cycle);
    var s = cycle.summary || {};
    var ro = isManager ? '' : ' readonly';

    function area(name, icon, label, placeholder) {
      return '<div class="field"><label>' + icon + ' ' + esc(label) + '</label>' +
        '<textarea data-sum="' + name + '"' + ro + ' placeholder="' + esc(placeholder) + '">' +
        esc(s[name] || '') + '</textarea></div>';
    }

    var stars = '';
    for (var i = 1; i <= 5; i++) {
      stars += '<button class="chip' + ((s.rating || 0) >= i ? ' sel' : '') + '" data-act="rate" data-v="' + i + '"' +
        (isManager ? '' : ' disabled') + '>' + (((s.rating || 0) >= i) ? '★' : '☆') + '</button>';
    }

    return '<div class="card"><h2>🏁 نتیجه‌ی دوره</h2>' +
        '<div class="stat-grid">' +
          stat('hero', 'نرخ تبدیل نهایی', UI.fcrText(r.fcr)) +
          stat('ok', 'جوجه‌ی باقی‌مانده', J.num(r.alive), 'قطعه') +
          stat(r.mortalityPct > 8 ? 'bad' : (r.mortalityPct > 4 ? 'warn' : 'ok'), 'تلفات', J.num(r.deaths), '(' + J.num(r.mortalityPct, 1) + '٪)') +
          stat('info', 'میانگین وزن', J.num(r.avgWeightG), 'گرم') +
          stat('info', 'کل دان', J.num(r.feedKg, 1), 'کیلو') +
        '</div>' +
        '<p class="tiny muted center" style="margin:10px 0 0">' +
          'دوره‌ی ' + esc(cycle.name) + ' • شروع ' + J.fmt(cycle.start.entryDate) + ' • روز ' + J.num(r.day) +
        '</p>' +
      '</div>' +
      (isManager ? moneyCard(cycle, r) : '') +

      '<div class="card"><div class="card-head"><h2>📝 نکات و جمع‌بندی</h2>' +
        (isManager ? '' : '<span class="badge">فقط خواندنی</span>') + '</div>' +
        area('breed', '🧬', 'نژاد و شرکت جوجه', 'کیفیت جوجه، یکنواختی، رشد، مشکلات…') +
        area('vaccine', '💉', 'واکسن و دارو', 'واکسن‌های انجام‌شده، واکنش گله، بیماری‌ها…') +
        area('feed', '🌾', 'دان و تغذیه', 'کیفیت دان، تغییر جیره، مصرف آب…') +
        area('worker', '👷', 'کارگر و کار روزانه', 'عملکرد کارگر، نظافت، دما و تهویه…') +
        area('general', '🏁', 'نتیجه‌گیری کلی دوره', 'چه چیزی خوب بود و دفعه‌ی بعد چه کنیم؟') +
        '<div class="field"><label>⭐ امتیاز کلی دوره</label><div class="chips">' + stars + '</div></div>' +
        (isManager ? '<button class="btn block" data-act="summary-save">💾 ذخیره‌ی جمع‌بندی</button>' : '') +
      '</div>' +

      '<div class="card"><h2>📤 خروجی</h2><div class="row-btns">' +
        '<button class="btn ghost grow" data-act="print">🖨️ چاپ / PDF</button>' +
        '<button class="btn ghost grow" data-act="share">📨 اشتراک متن گزارش</button>' +
        '</div>' +
        (isManager && cycle.status === 'active' ?
          '<button class="btn soft block" data-act="close-cycle" style="margin-top:10px">🔒 بستن دوره</button>' : '') +
        (cycle.status === 'closed' ? '<p class="center muted" style="margin:10px 0 0">این دوره بسته شده است.</p>' : '') +
      '</div>';
  }

  /* ================= متن گزارش (برای اشتراک‌گذاری) ================= */

  function reportText(cycle, isManager) {
    var r = Calc.report(cycle);
    var L = [];
    L.push('🐔 مرغینو — گزارش دوره «' + cycle.name + '»');
    L.push('تاریخ گزارش: ' + J.fmt(J.todayISO()) + ' (روز ' + J.num(r.day) + ')');
    L.push('ورود جوجه: ' + J.fmt(cycle.start.entryDate) + ' — ' + (cycle.start.breed || '—') +
           ' / ' + (cycle.start.company || '—'));
    L.push('');
    L.push('تعداد گله: ' + J.num(r.flock) + ' قطعه');
    L.push('تلفات: ' + J.num(r.deaths) + ' قطعه (' + J.num(r.mortalityPct, 1) + '٪)');
    L.push('زنده: ' + J.num(r.alive) + ' قطعه');
    L.push('میانگین وزن: ' + J.num(r.avgWeightG) + ' گرم');
    L.push('کل دان مصرفی: ' + J.num(r.feedKg, 1) + ' کیلو');
    L.push('نرخ تبدیل: ' + UI.fcrText(r.fcr));
    if (isManager) {
      L.push('');
      L.push('کل هزینه: ' + J.num(r.totalCost) + ' تومان');
      L.push('کل فروش: ' + J.num(r.income) + ' تومان');
      L.push('سود خالص: ' + J.num(r.profit) + ' تومان');
    }
    return L.join('\n');
  }

  global.Views = {
    render: function (tab, cycle, isManager) {
      if (tab === 'money') return renderMoney(cycle, isManager);
      if (tab === 'summary') return renderSummary(cycle, isManager);
      return renderReport(cycle, isManager);
    },
    reportText: reportText
  };
})(window);
