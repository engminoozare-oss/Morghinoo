/* مرغینو — پنجره‌های ثبت اطلاعات */
(function (global) {
  'use strict';

  var J = global.J, Store = global.Store, Calc = global.Calc, Notify = global.Notify, UI = global.UI;
  var $ = UI.$, $$ = UI.$$, esc = UI.esc;

  function refresh(msg) {
    UI.closeModal();
    if (msg) UI.toast(msg);
    global.App.render();
  }

  function numVal(root, sel) { return Store.num($(sel, root).value); }

  /* ================= تلفات روزانه ================= */

  function mortalityDialog(date) {
    date = date || J.todayISO();
    var cycle = Store.activeCycle();
    var rec = (cycle.mortality || []).filter(function (r) { return r.date === date; })[0] || {};
    var quick = [0, 1, 2, 3, 5, 10, 20];

    UI.modal({
      title: '🪶 ثبت تلفات',
      body:
        '<div class="field"><label>تعداد تلفات (قطعه)</label>' +
          '<div class="stepper">' +
            '<button type="button" data-act="dec">−</button>' +
            '<input type="number" inputmode="numeric" id="f-count" min="0" step="1" value="' + (rec.count != null ? rec.count : 0) + '">' +
            '<button type="button" data-act="inc">+</button>' +
          '</div>' +
          '<div class="chips" style="margin-top:8px">' +
            quick.map(function (q) { return '<button type="button" class="chip" data-act="quick" data-v="' + q + '">' + J.faDigits(q) + '</button>'; }).join('') +
          '</div>' +
        '</div>' +
        '<div class="field"><label>تاریخ</label>' + UI.jdateHTML('date', date) + '</div>' +
        '<div class="field"><label>توضیح (اختیاری)</label>' +
          '<input type="text" id="f-note" placeholder="مثلاً: تلفات زیر آبخوری" value="' + esc(rec.note || '') + '"></div>',
      onAct: function (act, btn, root) {
        var input = $('#f-count', root);
        if (act === 'inc') input.value = Store.num(input.value) + 1;
        if (act === 'dec') input.value = Math.max(0, Store.num(input.value) - 1);
        if (act === 'quick') {
          input.value = btn.getAttribute('data-v');
          $$('.chip[data-act=quick]', root).forEach(function (c) { c.classList.remove('sel'); });
          btn.classList.add('sel');
        }
      },
      onOk: function (root) {
        var d = UI.readJDate(root, 'date');
        Store.setDaily('mortality', d, {
          count: numVal(root, '#f-count'),
          note: $('#f-note', root).value.trim()
        });
        refresh('تلفات ثبت شد ✅');
      }
    });
  }

  /* ================= دان مصرفی روزانه ================= */

  function feedDialog(date) {
    date = date || J.todayISO();
    var cycle = Store.activeCycle();
    var rec = (cycle.feed || []).filter(function (r) { return r.date === date; })[0] || {};
    var avg = Calc.recentFeedAvg(cycle, 7);
    var types = ['پیش‌دانه', 'میان‌دانه', 'پس‌دانه', 'مخلوط'];

    UI.modal({
      title: '🌾 ثبت دان مصرفی',
      body:
        '<div class="field"><label>وزن دان مصرفی امروز (کیلوگرم)</label>' +
          '<div class="stepper">' +
            '<button type="button" data-act="dec">−</button>' +
            '<input type="number" inputmode="decimal" id="f-kg" min="0" step="0.5" value="' + (rec.kg != null ? rec.kg : '') + '" placeholder="۰">' +
            '<button type="button" data-act="inc">+</button>' +
          '</div>' +
          (avg > 0 ? '<div class="hint">میانگین هفته‌ی گذشته: ' + J.num(avg, 1) + ' کیلو در روز</div>' : '') +
        '</div>' +
        '<div class="field"><label>نوع دان</label><div class="chips">' +
          types.map(function (t) {
            return '<button type="button" class="chip' + (rec.type === t ? ' sel' : '') + '" data-act="type" data-v="' + t + '">' + t + '</button>';
          }).join('') + '</div></div>' +
        '<div class="field"><label>تاریخ</label>' + UI.jdateHTML('date', date) + '</div>',
      onAct: function (act, btn, root) {
        var input = $('#f-kg', root);
        if (act === 'inc') input.value = Store.num(input.value) + 10;
        if (act === 'dec') input.value = Math.max(0, Store.num(input.value) - 10);
        if (act === 'type') {
          $$('.chip[data-act=type]', root).forEach(function (c) { c.classList.remove('sel'); });
          btn.classList.add('sel');
        }
      },
      onOk: function (root) {
        var kg = numVal(root, '#f-kg');
        if (kg <= 0) { UI.toast('وزن دان را وارد کنید'); return; }
        var sel = $('.chip[data-act=type].sel', root);
        Store.setDaily('feed', UI.readJDate(root, 'date'), {
          kg: kg,
          type: sel ? sel.getAttribute('data-v') : ''
        });
        refresh('دان ثبت شد ✅');
      }
    });
  }

  /* ================= وزن‌کشی هفتگی ================= */

  function weightDialog(id) {
    var cycle = Store.activeCycle();
    var rec = id ? (cycle.weights || []).filter(function (r) { return r.id === id; })[0] : null;
    var date = rec ? rec.date : J.todayISO();

    UI.modal({
      title: '⚖️ ثبت وزن‌کشی',
      body:
        '<div class="field"><label>میانگین وزن هر مرغ (گرم)</label>' +
          '<input type="number" inputmode="decimal" id="f-w" min="0" step="10" value="' + (rec ? rec.avgWeight : '') + '" placeholder="مثلاً ۱۲۵۰"></div>' +
        '<div class="field"><label>چند مرغ وزن شد؟ (اختیاری)</label>' +
          '<input type="number" inputmode="numeric" id="f-sample" min="0" step="1" value="' + (rec && rec.sample ? rec.sample : '') + '" placeholder="مثلاً ۱۰"></div>' +
        '<div class="field"><label>تاریخ وزن‌کشی</label>' + UI.jdateHTML('date', date) + '</div>' +
        '<div class="field"><label>توضیح (اختیاری)</label>' +
          '<input type="text" id="f-note" value="' + esc(rec && rec.note ? rec.note : '') + '" placeholder="یکنواختی گله، وضعیت ظاهری…"></div>',
      footer: (rec ? '<button class="btn danger sm" data-act="del">🗑</button>' : '') +
              '<button class="btn ghost" data-act="close-modal">انصراف</button>' +
              '<button class="btn" data-act="modal-ok">ثبت</button>',
      onAct: function (act) {
        if (act === 'del') {
          UI.confirmBox('حذف وزن‌کشی', 'این وزن‌کشی حذف شود؟', function () {
            Store.remove('weights', id);
            refresh('حذف شد');
          });
        }
      },
      onOk: function (root) {
        var w = numVal(root, '#f-w');
        if (w <= 0) { UI.toast('وزن را وارد کنید'); return; }
        Store.upsert('weights', {
          id: id,
          date: UI.readJDate(root, 'date'),
          avgWeight: w,
          sample: numVal(root, '#f-sample'),
          note: $('#f-note', root).value.trim()
        });
        refresh('وزن‌کشی ثبت شد ✅');
      }
    });
  }

  /* ================= واکسن ================= */

  function vaccineDialog(id) {
    var cycle = Store.activeCycle();
    var rec = id ? (cycle.vaccines || []).filter(function (r) { return r.id === id; })[0] : null;
    var common = ['نیوکاسل', 'گامبورو', 'برونشیت', 'آنفلوانزا', 'آبله'];

    UI.modal({
      title: rec ? '💉 ویرایش واکسن' : '💉 واکسن جدید',
      body:
        '<div class="field"><label>نام واکسن</label>' +
          '<input type="text" id="f-name" value="' + esc(rec ? rec.name : '') + '" placeholder="مثلاً نیوکاسل">' +
          '<div class="chips" style="margin-top:8px">' +
            common.map(function (c) { return '<button type="button" class="chip" data-act="pick" data-v="' + c + '">' + c + '</button>'; }).join('') +
          '</div></div>' +
        '<div class="field"><label>تاریخ واکسن</label>' + UI.jdateHTML('date', rec ? rec.date : J.todayISO()) +
          '<div class="hint">یک روز قبل، یادآوری برای مدیر و کارگر فرستاده می‌شود.</div></div>' +
        '<div class="field"><label>توضیح (اختیاری)</label>' +
          '<input type="text" id="f-note" value="' + esc(rec && rec.note ? rec.note : '') + '" placeholder="روش مصرف: آب آشامیدنی، قطره چشمی…"></div>' +
        (rec ? '<label class="remember"><input type="checkbox" id="f-done"' + (rec.done ? ' checked' : '') + '><span>انجام شد</span></label>' : ''),
      footer: (rec ? '<button class="btn danger sm" data-act="del">🗑</button>' : '') +
              '<button class="btn ghost" data-act="close-modal">انصراف</button>' +
              '<button class="btn" data-act="modal-ok">ثبت</button>',
      onAct: function (act, btn, root) {
        if (act === 'pick') $('#f-name', root).value = btn.getAttribute('data-v');
        if (act === 'del') {
          UI.confirmBox('حذف واکسن', 'این واکسن حذف شود؟', function () {
            Store.remove('vaccines', id);
            refresh('حذف شد');
          });
        }
      },
      onOk: function (root) {
        var name = $('#f-name', root).value.trim();
        if (!name) { UI.toast('نام واکسن را بنویسید'); return; }
        var done = $('#f-done', root);
        Store.upsert('vaccines', {
          id: id,
          name: name,
          date: UI.readJDate(root, 'date'),
          note: $('#f-note', root).value.trim(),
          done: done ? done.checked : false
        });
        refresh('واکسن ثبت شد ✅');
      }
    });
  }

  /** یادآور روز واکسن — برای مدیر همان پنجره‌ی ویرایش، برای کارگر یک تأیید ساده */
  function vaccineDayDialog(id) {
    var cycle = Store.activeCycle();
    var v = (cycle.vaccines || []).filter(function (r) { return r.id === id; })[0];
    if (!v) { UI.toast('واکسن پیدا نشد'); return; }
    if (Store.isManager()) { vaccineDialog(id); return; }

    var d = J.diffDays(J.todayISO(), v.date);
    var canDo = d <= 0;

    UI.modal({
      title: '💉 ' + (d === 1 ? 'فردا روز واکسن است' : 'روز واکسن'),
      body:
        '<div class="stat hero"><span class="k">' + (d === 1 ? 'واکسن فردا' : 'واکسن امروز') + '</span>' +
          '<span class="v" style="font-size:28px">' + esc(v.name) + '</span></div>' +
        '<div class="list" style="margin-top:12px">' +
          '<div class="item"><span class="ico">📅</span><div class="body"><div class="s">تاریخ واکسن</div></div>' +
          '<span class="val">' + J.fmt(v.date) + '</span></div>' +
          (v.note ? '<div class="item"><span class="ico">📝</span><div class="body"><div class="s">' +
            esc(v.note) + '</div></div></div>' : '') +
        '</div>',
      footer: '<button class="btn ghost" data-act="close-modal">باشه</button>' +
        (canDo ? '<button class="btn ok" data-act="modal-ok">✔ واکسن زده شد</button>' : ''),
      onOk: function () {
        Store.upsert('vaccines', { id: id, done: true });
        refresh('واکسن انجام‌شده ثبت شد ✅');
      }
    });
  }

  /* ================= هزینه ================= */

  function expenseDialog(id, presetCat) {
    var cycle = Store.activeCycle();
    var rec = id ? (cycle.expenses || []).filter(function (r) { return r.id === id; })[0] : null;
    var cat = rec ? rec.cat : (presetCat || 'chick');

    var grid = Store.CATEGORIES.map(function (c) {
      return '<button type="button" class="cat-btn' + (c.id === cat ? ' sel' : '') + '" data-act="cat" data-v="' + c.id + '">' +
        '<span class="ico">' + c.icon + '</span><span class="lbl">' + esc(c.label) + '</span></button>';
    }).join('');

    UI.modal({
      title: rec ? '✎ ویرایش هزینه' : '➕ هزینه‌ی جدید',
      body:
        '<div class="field"><label>نوع هزینه</label><div class="cat-grid">' + grid + '</div></div>' +
        '<div class="grid-2">' +
          '<div class="field"><label>مقدار <span class="muted" id="f-unit">(' + esc(Store.category(cat).unit) + ')</span></label>' +
            '<input type="number" inputmode="decimal" id="f-qty" min="0" step="any" value="' + (rec ? rec.qty : '') + '" placeholder="۰"></div>' +
          '<div class="field"><label>فی (تومان)</label>' +
            '<input type="number" inputmode="decimal" id="f-price" min="0" step="any" value="' + (rec ? rec.unitPrice : '') + '" placeholder="۰"></div>' +
        '</div>' +
        '<div class="field"><label>مبلغ کل (تومان)</label>' +
          '<input type="number" inputmode="decimal" id="f-total" min="0" step="any" value="' + (rec ? rec.total : '') + '" placeholder="۰">' +
          '<div class="hint" id="f-total-hint">مقدار × فی به‌صورت خودکار حساب می‌شود؛ می‌توانید دستی هم بنویسید.</div></div>' +
        '<div class="field"><label>تاریخ خرید</label>' + UI.jdateHTML('date', rec ? rec.date : J.todayISO()) + '</div>' +
        '<div class="field"><label>توضیح (اختیاری)</label>' +
          '<input type="text" id="f-note" value="' + esc(rec && rec.note ? rec.note : '') + '" placeholder="نام فروشنده، شماره فاکتور…"></div>',
      footer: (rec ? '<button class="btn danger sm" data-act="del">🗑</button>' : '') +
              '<button class="btn ghost" data-act="close-modal">انصراف</button>' +
              '<button class="btn" data-act="modal-ok">ثبت</button>',
      onMount: function (root) {
        var qty = $('#f-qty', root), price = $('#f-price', root), total = $('#f-total', root);
        var hint = $('#f-total-hint', root);

        function fromQtyPrice() {
          var q = Store.num(qty.value), p = Store.num(price.value);
          if (q > 0 && p > 0) {
            total.value = Math.round(q * p);
            hint.textContent = J.num(q, 2) + ' × ' + J.num(p) + ' = ' + J.num(q * p) + ' تومان';
          }
        }
        function fromTotal() {
          var q = Store.num(qty.value), t = Store.num(total.value);
          if (q > 0 && t > 0) {
            price.value = Math.round((t / q) * 100) / 100;
            hint.textContent = 'فی هر واحد: ' + J.num(t / q) + ' تومان';
          }
        }
        qty.addEventListener('input', fromQtyPrice);
        price.addEventListener('input', fromQtyPrice);
        total.addEventListener('input', fromTotal);
      },
      onAct: function (act, btn, root) {
        if (act === 'cat') {
          cat = btn.getAttribute('data-v');
          $$('.cat-btn', root).forEach(function (c) { c.classList.remove('sel'); });
          btn.classList.add('sel');
          $('#f-unit', root).textContent = '(' + Store.category(cat).unit + ')';
        }
        if (act === 'del') {
          UI.confirmBox('حذف هزینه', 'این هزینه حذف شود؟', function () {
            Store.remove('expenses', id);
            refresh('حذف شد');
          });
        }
      },
      onOk: function (root) {
        var total = numVal(root, '#f-total');
        var qty = numVal(root, '#f-qty');
        var price = numVal(root, '#f-price');
        if (!total && qty && price) total = qty * price;
        if (total <= 0) { UI.toast('مبلغ را وارد کنید'); return; }
        Store.upsert('expenses', {
          id: id,
          cat: cat,
          qty: qty,
          unitPrice: price,
          total: total,
          date: UI.readJDate(root, 'date'),
          note: $('#f-note', root).value.trim()
        });
        refresh('هزینه ثبت شد ✅');
      }
    });
  }

  /** فهرست هزینه‌های یک دسته */
  function categoryDialog(catId) {
    var cycle = Store.activeCycle();
    var c = Store.category(catId);
    var rows = (cycle.expenses || []).filter(function (e) { return e.cat === catId; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var total = Calc.sum(rows, function (e) { return e.total; });
    var qty = Calc.sum(rows, function (e) { return e.qty; });

    var body = rows.length ? '<div class="list">' + rows.map(function (e) {
      return '<div class="item tap" data-act="edit" data-id="' + e.id + '">' +
        '<span class="ico">' + c.icon + '</span>' +
        '<div class="body"><div class="t">' + J.num(e.qty, 2) + ' ' + esc(c.unit) +
        ' × ' + J.num(e.unitPrice) + '</div>' +
        '<div class="s">' + J.fmt(e.date) + (e.note ? ' • ' + esc(e.note) : '') + '</div></div>' +
        '<span class="val money">' + J.num(e.total) + '</span></div>';
    }).join('') + '</div>' : UI.emptyBox(c.icon, 'برای این دسته هزینه‌ای ثبت نشده است.');

    UI.modal({
      title: c.icon + ' ' + c.label,
      body: '<div class="stat-grid" style="margin-bottom:12px">' +
          UI.stat('info', 'مجموع مقدار', J.num(qty, 2), c.unit) +
          UI.stat('bad', 'مجموع هزینه', J.num(total), 'تومان') +
        '</div>' + body,
      footer: '<button class="btn ghost" data-act="close-modal">بستن</button>' +
              '<button class="btn" data-act="add">➕ ثبت جدید</button>',
      onAct: function (act, btn) {
        if (act === 'add') expenseDialog(null, catId);
        if (act === 'edit') expenseDialog(btn.getAttribute('data-id'));
      }
    });
  }

  /* ================= فروش مرغ ================= */

  function saleDialog() {
    var cycle = Store.activeCycle();
    var s = cycle.sale || {};
    var r = Calc.report(cycle);

    UI.modal({
      title: '🐔 فروش مرغ',
      body:
        '<div class="field"><label>فی روز مرغ — قیمت هر کیلو (تومان)</label>' +
          '<input type="number" inputmode="decimal" id="f-price" min="0" step="any" value="' + (s.pricePerKg || '') + '" placeholder="مثلاً ۷۵۰۰۰"></div>' +
        '<div class="field"><label>تعداد مرغ فروخته‌شده</label>' +
          '<input type="number" inputmode="numeric" id="f-count" min="0" step="1" value="' + (s.soldCount != null && s.soldCount !== '' ? s.soldCount : '') + '" placeholder="' + J.faDigits(r.alive) + ' (باقی‌مانده‌ی گله)">' +
          '<div class="hint">خالی بگذارید تا تعداد باقی‌مانده‌ی گله (' + J.num(r.alive) + ' قطعه) حساب شود.</div></div>' +
        '<div class="field"><label>درآمد دیگر (کود، کیسه…) — تومان</label>' +
          '<input type="number" inputmode="decimal" id="f-extra" min="0" step="any" value="' + (s.extraIncome || '') + '" placeholder="۰"></div>' +
        '<div class="field"><label>تاریخ فروش</label>' + UI.jdateHTML('date', s.date || J.todayISO()) + '</div>' +
        '<div class="card" style="margin:0"><div id="f-preview"></div></div>',
      onMount: function (root) {
        function preview() {
          var price = Store.num($('#f-price', root).value);
          var cnt = $('#f-count', root).value === '' ? r.alive : Store.num($('#f-count', root).value);
          var extra = Store.num($('#f-extra', root).value);
          var kg = cnt * r.avgWeightKg;
          var income = kg * price + extra;
          $('#f-preview', root).innerHTML =
            '<div class="tiny muted">' + J.num(cnt) + ' قطعه × ' + J.num(r.avgWeightKg, 3) + ' کیلو = ' +
            J.num(kg, 1) + ' کیلو</div>' +
            '<div class="stat info" style="margin-top:8px"><span class="k">مبلغ کل فروش</span>' +
            '<span class="v money">' + J.num(income) + ' <span class="u">تومان</span></span></div>' +
            '<div class="stat ' + (income - r.totalCost >= 0 ? 'ok' : 'bad') + '" style="margin-top:8px">' +
            '<span class="k">سود خالص (فروش − هزینه)</span>' +
            '<span class="v money">' + J.num(income - r.totalCost) + ' <span class="u">تومان</span></span></div>';
        }
        $$('input', root).forEach(function (i) { i.addEventListener('input', preview); });
        preview();
      },
      onOk: function (root) {
        var cnt = $('#f-count', root).value;
        cycle.sale = {
          pricePerKg: numVal(root, '#f-price'),
          soldCount: cnt === '' ? null : Store.num(cnt),
          extraIncome: numVal(root, '#f-extra'),
          date: UI.readJDate(root, 'date'),
          note: ''
        };
        Store.save();
        refresh('اطلاعات فروش ذخیره شد ✅');
      }
    });
  }

  /* ================= ویرایش یک روز ================= */

  function dayDialog(date) {
    var cycle = Store.activeCycle();
    var m = (cycle.mortality || []).filter(function (r) { return r.date === date; })[0];
    var f = (cycle.feed || []).filter(function (r) { return r.date === date; })[0];
    UI.modal({
      title: '📆 ' + J.fmtWithDay(date),
      body: '<div class="list">' +
        '<div class="item"><span class="ico">🪶</span><div class="body"><div class="t">تلفات</div>' +
        '<div class="s">' + (m ? J.num(m.count) + ' قطعه' : 'ثبت نشده') + '</div></div>' +
        '<button class="btn sm" data-act="m">✎</button></div>' +
        '<div class="item"><span class="ico">🌾</span><div class="body"><div class="t">دان مصرفی</div>' +
        '<div class="s">' + (f ? J.num(f.kg, 1) + ' کیلو' : 'ثبت نشده') + '</div></div>' +
        '<button class="btn sm" data-act="f">✎</button></div>' +
        '</div>',
      footer: '<button class="btn ghost" data-act="close-modal">بستن</button>',
      onAct: function (act) {
        if (act === 'm') mortalityDialog(date);
        if (act === 'f') feedDialog(date);
      }
    });
  }

  /* ================= تاریخ استعلام نرخ تبدیل ================= */

  function fcrDateDialog() {
    UI.modal({
      title: '📅 نرخ تبدیل تا چه تاریخی؟',
      body: '<div class="field"><label>تاریخ استعلام</label>' +
        UI.jdateHTML('date', UI.state.fcrDate || J.todayISO()) + '</div>',
      onOk: function (root) {
        UI.state.fcrDate = UI.readJDate(root, 'date');
        refresh();
      }
    });
  }

  global.Dialogs = {
    mortality: mortalityDialog,
    feed: feedDialog,
    weight: weightDialog,
    vaccine: vaccineDialog,
    vaccineDay: vaccineDayDialog,
    expense: expenseDialog,
    category: categoryDialog,
    sale: saleDialog,
    day: dayDialog,
    fcrDate: fcrDateDialog,
    refresh: refresh
  };
})(window);
