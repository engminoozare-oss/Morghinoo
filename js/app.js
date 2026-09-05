/* مرغینو — راه‌اندازی برنامه، ورود کاربر، منو و مسیریابی تب‌ها */
(function (global) {
  'use strict';

  var J = global.J, Store = global.Store, Calc = global.Calc,
      Notify = global.Notify, UI = global.UI, Views = global.Views, Dialogs = global.Dialogs;
  var $ = UI.$, $$ = UI.$$, esc = UI.esc;

  var deferredInstall = null;

  /* ================= ورود ================= */

  var pinRole = null, pinValue = '';

  function showLogin() {
    $('#screen-app').classList.add('hidden');
    $('#screen-login').classList.remove('hidden');
    $('#login-roles').classList.remove('hidden');
    $('#login-pin').classList.add('hidden');
    $('#login-farm').textContent = Store.get().settings.farmName || 'مدیریت مرغداری';
    pinValue = '';
    drawPin();
  }

  function drawPin() {
    $$('#pin-dots i').forEach(function (d, i) { d.classList.toggle('on', i < pinValue.length); });
  }

  function buildKeypad() {
    var pad = $('#keypad');
    var keys = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹', '⌫', '۰', '✔'];
    pad.innerHTML = keys.map(function (k, i) {
      var v = i === 9 ? 'del' : (i === 11 ? 'ok' : String(k === '۰' ? 0 : i + 1));
      return '<button type="button" data-key="' + v + '"' + (i > 8 ? ' class="wide"' : '') + '>' + k + '</button>';
    }).join('');
  }

  function tryLogin() {
    var remember = $('#pin-remember').checked;
    if (Store.login(pinRole, pinValue, remember)) {
      pinValue = '';
      showApp();
    } else {
      $('#pin-error').textContent = 'رمز درست نیست، دوباره امتحان کنید';
      pinValue = '';
      drawPin();
      if (navigator.vibrate) navigator.vibrate(200);
    }
  }

  function bindLogin() {
    buildKeypad();

    $('#login-roles').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-role]');
      if (!btn) return;
      pinRole = btn.getAttribute('data-role');
      pinValue = '';
      $('#pin-error').textContent = '';
      $('#pin-role-label').textContent = pinRole === 'manager' ? '👨‍💼 ورود مدیر' : '👷 ورود کارگر';
      $('#login-roles').classList.add('hidden');
      $('#login-pin').classList.remove('hidden');
      drawPin();
    });

    $('#pin-back').addEventListener('click', showLogin);

    $('#keypad').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-key]');
      if (!btn) return;
      var k = btn.getAttribute('data-key');
      $('#pin-error').textContent = '';
      if (k === 'del') pinValue = pinValue.slice(0, -1);
      else if (k === 'ok') { if (pinValue.length) tryLogin(); }
      else if (pinValue.length < 4) pinValue += k;
      drawPin();
      if (pinValue.length === 4) setTimeout(tryLogin, 120);
    });
  }

  /* ================= صفحه‌ی اصلی ================= */

  function showApp() {
    $('#screen-login').classList.add('hidden');
    $('#screen-app').classList.remove('hidden');
    var s = Store.get();
    if (!s.cycles.length) UI.state.tab = 'report';
    render();
    handleShortcut();
    maybeAskNotifications();
    Notify.startWatching(Store.activeCycle, function () { return Store.get().settings; });
  }

  function render() {
    var s = Store.get();
    var isManager = Store.isManager();
    var cycle = Store.activeCycle();

    // قفل تب هزینه‌ها برای کارگر
    $$('#tabbar .tab').forEach(function (t) {
      var tab = t.getAttribute('data-tab');
      t.classList.toggle('is-active', tab === UI.state.tab);
      t.classList.toggle('is-locked', tab === 'money' && !isManager);
    });

    if (!cycle) {
      $('#cycle-name').textContent = 'مرغینو';
      $('#cycle-sub').textContent = isManager ? 'هنوز دوره‌ای تعریف نشده' : 'منتظر تعریف دوره توسط مدیر';
      $('#view').innerHTML =
        '<div class="card center" style="padding:36px 16px">' +
          '<div style="font-size:64px">🐣</div>' +
          '<h2 style="justify-content:center">هنوز دوره‌ای نداریم</h2>' +
          '<p class="muted">' + (isManager
            ? 'برای شروع، یک دوره‌ی پرورش جدید تعریف کنید.'
            : 'مدیر باید اول دوره‌ی پرورش را تعریف کند.') + '</p>' +
          (isManager ? '<button class="btn block" data-act="cycle-new" style="margin-top:12px">➕ تعریف دوره‌ی جدید</button>' : '') +
        '</div>';
      return;
    }

    var r = Calc.report(cycle);
    $('#cycle-name').textContent = cycle.name;
    $('#cycle-sub').textContent = 'روز ' + J.num(r.day) + ' از ' + J.num(r.duration) +
      ' • ' + (isManager ? 'مدیر' : 'کارگر') + (cycle.status === 'closed' ? ' • بسته‌شده' : '');

    $('#view').innerHTML = Views.render(UI.state.tab, cycle, isManager);
    $('#view').scrollTop = 0;
    window.scrollTo(0, 0);
  }

  /** میان‌بُرهای صفحه‌ی خانه: index.html?do=mortality یا ?do=feed */
  function handleShortcut() {
    var m = /[?&]do=([a-z]+)/.exec(location.search);
    if (!m || !Store.activeCycle()) return;
    history.replaceState(null, '', location.pathname);
    if (m[1] === 'mortality') Dialogs.mortality();
    else if (m[1] === 'feed') Dialogs.feed();
    else if (m[1] === 'weight') Dialogs.weight();
  }

  /* ================= تعریف / ویرایش دوره ================= */

  function cycleWizard(edit) {
    var c = edit ? Store.activeCycle() : null;
    var s = c ? c.start : {};
    var defName = 'دوره ' + J.faDigits(J.isoToJ(J.todayISO()).jy) + '-' + J.faDigits(Store.get().cycles.length + 1);

    UI.modal({
      title: c ? '✎ ویرایش مشخصات دوره' : '🐣 دوره‌ی پرورش جدید',
      body:
        '<div class="field"><label>نام دوره</label>' +
          '<input type="text" id="f-name" value="' + esc(c ? c.name : defName) + '"></div>' +
        '<div class="field"><label>📅 تاریخ ورود جوجه</label>' +
          UI.jdateHTML('date', s.entryDate || J.todayISO()) + '</div>' +
        '<div class="grid-2">' +
          '<div class="field"><label>🧬 نژاد جوجه</label>' +
            '<input type="text" id="f-breed" value="' + esc(s.breed || '') + '" placeholder="راس ۳۰۸، کاب ۵۰۰…"></div>' +
          '<div class="field"><label>🏭 شرکت جوجه</label>' +
            '<input type="text" id="f-company" value="' + esc(s.company || '') + '" placeholder="نام شرکت"></div>' +
        '</div>' +
        '<div class="grid-2">' +
          '<div class="field"><label>🐥 تعداد گله (قطعه)</label>' +
            '<input type="number" inputmode="numeric" id="f-count" min="0" step="1" value="' + (s.flockCount || '') + '" placeholder="مثلاً ۱۰۰۰۰"></div>' +
          '<div class="field"><label>⚖️ وزن اولیه (گرم)</label>' +
            '<input type="number" inputmode="decimal" id="f-weight" min="0" step="any" value="' + (s.initialWeight || '') + '" placeholder="مثلاً ۴۲"></div>' +
        '</div>' +
        '<div class="field"><label>⏳ طول دوره (روز)</label>' +
          '<input type="number" inputmode="numeric" id="f-days" min="1" step="1" value="' + (s.durationDays || 90) + '">' +
          '<div class="hint">دوره‌ی پرورش معمولاً حدود ۹۰ روز (سه ماه) است.</div></div>',
      onOk: function (root) {
        var data = {
          name: $('#f-name', root).value.trim() || defName,
          entryDate: UI.readJDate(root, 'date'),
          breed: $('#f-breed', root).value.trim(),
          company: $('#f-company', root).value.trim(),
          flockCount: Store.num($('#f-count', root).value),
          initialWeight: Store.num($('#f-weight', root).value),
          durationDays: Store.num($('#f-days', root).value) || 90
        };
        if (!data.flockCount) { UI.toast('تعداد گله را وارد کنید'); return; }
        if (c) {
          c.name = data.name;
          c.start = {
            entryDate: data.entryDate, breed: data.breed, company: data.company,
            flockCount: data.flockCount, initialWeight: data.initialWeight,
            durationDays: data.durationDays
          };
          Store.save();
        } else {
          Store.addCycle(data);
          UI.state.tab = 'report';
        }
        Dialogs.refresh(c ? 'ذخیره شد ✅' : 'دوره‌ی جدید ساخته شد 🐣');
      }
    });
  }

  /* ================= منو ================= */

  function menuDialog() {
    var isManager = Store.isManager();
    var cycles = Store.get().cycles;

    function item(act, ico, label, extra) {
      return '<button class="drawer-item" data-act="' + act + '">' +
        '<span class="ico">' + ico + '</span><span class="grow">' + esc(label) + '</span>' +
        (extra ? '<span class="badge">' + extra + '</span>' : '') + '</button>';
    }

    UI.modal({
      title: '☰ منو',
      body: '<div class="drawer-list">' +
        (isManager ? item('cycle-new', '🐣', 'تعریف دوره‌ی جدید') : '') +
        item('cycles', '📚', 'دوره‌ها', J.faDigits(cycles.length)) +
        (isManager ? item('cycle-edit', '✎', 'ویرایش مشخصات دوره') : '') +
        (isManager ? item('vaccine-add', '💉', 'افزودن واکسن') : '') +
        item('notif', '🔔', 'اعلان‌ها و یادآوری') +
        (isManager ? item('settings', '⚙️', 'تنظیمات و رمزها') : '') +
        item('install', '📲', 'نصب برنامه روی گوشی/ویندوز') +
        (isManager ? item('backup', '💾', 'پشتیبان‌گیری و بازیابی') : '') +
        item('about', 'ℹ️', 'راهنما') +
        item('switch-user', '🔁', 'تعویض کاربر') +
        '</div>',
      footer: null
    });
  }

  function cyclesDialog() {
    var s = Store.get();
    var isManager = Store.isManager();
    var rows = s.cycles.slice().reverse().map(function (c) {
      var r = Calc.report(c);
      return '<div class="item tap" data-act="pick-cycle" data-id="' + c.id + '">' +
        '<span class="ico">' + (c.id === s.activeCycleId ? '✅' : '🐔') + '</span>' +
        '<div class="body"><div class="t">' + esc(c.name) + '</div>' +
        '<div class="s">' + J.fmt(c.start.entryDate) + ' • ' + J.num(c.start.flockCount) + ' قطعه • ' +
        (c.status === 'closed' ? 'بسته‌شده' : 'روز ' + J.num(r.day)) + '</div></div>' +
        (isManager ? '<button class="btn sm danger" data-act="del-cycle" data-id="' + c.id + '">🗑</button>' : '') +
        '</div>';
    }).join('');

    UI.modal({
      title: '📚 دوره‌ها',
      body: s.cycles.length ? '<div class="list">' + rows + '</div>' : UI.emptyBox('🐣', 'هنوز دوره‌ای ساخته نشده است.'),
      footer: '<button class="btn ghost" data-act="close-modal">بستن</button>' +
        (isManager ? '<button class="btn" data-act="cycle-new">➕ دوره‌ی جدید</button>' : ''),
      onAct: function (act, btn) {
        if (act === 'pick-cycle') {
          Store.setActiveCycle(btn.getAttribute('data-id'));
          Dialogs.refresh('دوره تغییر کرد');
        }
        if (act === 'del-cycle') {
          var id = btn.getAttribute('data-id');
          UI.confirmBox('حذف دوره', 'همه‌ی اطلاعات این دوره پاک می‌شود. مطمئنید؟', function () {
            Store.deleteCycle(id);
            Dialogs.refresh('دوره حذف شد');
          });
        }
      }
    });
  }

  function notifDialog() {
    var st = Store.get().settings;
    var perm = Notify.permission();
    var permText = perm === 'granted' ? '<span class="badge ok">فعال است</span>'
      : perm === 'denied' ? '<span class="badge bad">در مرورگر مسدود شده</span>'
      : perm === 'unsupported' ? '<span class="badge bad">این مرورگر پشتیبانی نمی‌کند</span>'
      : '<span class="badge">هنوز اجازه داده نشده</span>';

    var hours = '';
    for (var h = 6; h <= 22; h++) {
      hours += '<option value="' + h + '"' + (h === (st.reminderHour || 17) ? ' selected' : '') + '>' +
        J.faDigits(h) + ':۰۰</option>';
    }

    UI.modal({
      title: '🔔 اعلان‌ها و یادآوری',
      body:
        '<div class="alert info"><span class="ico">🔔</span><div class="body">' +
          '<div class="t">وضعیت اعلان: ' + permText + '</div>' +
          '<div class="s">یادآوری ثبت تلفات و دان هر روز، وزن‌کشی هر هفته و واکسن یک روز قبل فرستاده می‌شود.</div>' +
        '</div></div>' +
        (perm !== 'granted' ? '<button class="btn block" data-act="ask-perm" style="margin-bottom:12px">✅ اجازه‌ی نمایش اعلان</button>' : '') +
        '<div class="field"><label>ساعت یادآوری روزانه</label><select id="f-hour">' + hours + '</select></div>' +
        '<label class="remember" style="justify-content:flex-start">' +
          '<input type="checkbox" id="f-on"' + (st.notifications !== false ? ' checked' : '') + '>' +
          '<span>یادآورها روشن باشد</span></label>' +
        '<button class="btn ghost block" data-act="test" style="margin-top:12px">🔔 آزمایش اعلان</button>' +
        '<p class="tiny muted" style="margin-top:10px">نکته: در آیفون، اعلان فقط وقتی کار می‌کند که برنامه از طریق «افزودن به صفحه‌ی خانه» نصب شده باشد. یادآورها هر بار که برنامه را باز کنید هم روی صفحه نشان داده می‌شوند.</p>',
      onAct: function (act, btn, root) {
        if (act === 'ask-perm') {
          Notify.requestPermission().then(function (p) {
            UI.toast(p === 'granted' ? 'اعلان فعال شد ✅' : 'اجازه داده نشد');
            UI.closeModal();
          });
        }
        if (act === 'test') Notify.show('مرغینو', 'اعلان آزمایشی — همه‌چیز درست کار می‌کند ✅', 'test');
      },
      onOk: function (root) {
        var st2 = Store.get().settings;
        st2.reminderHour = +$('#f-hour', root).value;
        st2.notifications = $('#f-on', root).checked;
        Store.save();
        Dialogs.refresh('ذخیره شد ✅');
      }
    });
  }

  function settingsDialog() {
    var st = Store.get().settings;
    UI.modal({
      title: '⚙️ تنظیمات',
      body:
        '<div class="field"><label>نام مرغداری</label>' +
          '<input type="text" id="f-farm" value="' + esc(st.farmName || '') + '"></div>' +
        '<div class="grid-2">' +
          '<div class="field"><label>🔑 رمز مدیر (۴ رقم)</label>' +
            '<input type="number" inputmode="numeric" id="f-mpin" value="' + esc(st.managerPin) + '"></div>' +
          '<div class="field"><label>🔑 رمز کارگر (۴ رقم)</label>' +
            '<input type="number" inputmode="numeric" id="f-wpin" value="' + esc(st.workerPin) + '"></div>' +
        '</div>' +
        '<p class="tiny muted">رمزها فقط روی همین دستگاه ذخیره می‌شوند و جلوی دسترسی ساده را می‌گیرند؛ جای قفل واقعی گوشی را نمی‌گیرند.</p>',
      onOk: function (root) {
        var m = $('#f-mpin', root).value.trim(), w = $('#f-wpin', root).value.trim();
        if (!/^\d{4}$/.test(m) || !/^\d{4}$/.test(w)) { UI.toast('رمزها باید ۴ رقم باشند'); return; }
        if (m === w) { UI.toast('رمز مدیر و کارگر نباید یکی باشد'); return; }
        var s = Store.get().settings;
        s.farmName = $('#f-farm', root).value.trim();
        s.managerPin = m;
        s.workerPin = w;
        Store.save();
        Dialogs.refresh('تنظیمات ذخیره شد ✅');
      }
    });
  }

  function backupDialog() {
    UI.modal({
      title: '💾 پشتیبان‌گیری',
      body:
        '<p class="tiny muted">اطلاعات مرغینو فقط روی همین دستگاه ذخیره می‌شود. برای اینکه از بین نرود، هر چند وقت یک‌بار فایل پشتیبان بگیرید.</p>' +
        '<button class="btn block" data-act="export" style="margin:12px 0">⬇️ گرفتن فایل پشتیبان</button>' +
        '<div class="field"><label>بازیابی از فایل پشتیبان</label>' +
          '<input type="file" id="f-file" accept="application/json,.json"></div>' +
        '<p class="tiny muted">با بازیابی، اطلاعات فعلی این دستگاه جایگزین می‌شود.</p>',
      footer: '<button class="btn ghost" data-act="close-modal">بستن</button>',
      onMount: function (root) {
        $('#f-file', root).addEventListener('change', function (ev) {
          var file = ev.target.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function () {
            try {
              Store.importJSON(reader.result);
              Dialogs.refresh('اطلاعات بازیابی شد ✅');
            } catch (e) {
              UI.toast('فایل معتبر نیست');
            }
          };
          reader.readAsText(file);
        });
      },
      onAct: function (act) {
        if (act !== 'export') return;
        var blob = new Blob([Store.exportJSON()], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'morghino-backup-' + J.todayISO() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        UI.toast('فایل پشتیبان ساخته شد');
      }
    });
  }

  function installDialog() {
    var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    UI.modal({
      title: '📲 نصب مرغینو',
      body:
        (deferredInstall ? '<button class="btn block" data-act="do-install" style="margin-bottom:14px">📲 نصب روی این دستگاه</button>' : '') +
        '<div class="card"><h3>🤖 اندروید</h3><p class="tiny">در مرورگر کروم، منوی سه‌نقطه ← «افزودن به صفحه اصلی» یا «نصب برنامه».</p></div>' +
        '<div class="card"><h3>🍎 آیفون و آیپد</h3><p class="tiny">در مرورگر سافاری، دکمه‌ی اشتراک‌گذاری ⬆️ ← «Add to Home Screen / افزودن به صفحه خانه».</p></div>' +
        '<div class="card"><h3>🖥️ ویندوز</h3><p class="tiny">در کروم یا اِج، آیکن نصب ⊕ در نوار آدرس ← «Install / نصب».</p></div>' +
        (isIOS ? '<p class="tiny muted">در آیفون حتماً از سافاری استفاده کنید.</p>' : ''),
      footer: '<button class="btn ghost" data-act="close-modal">بستن</button>',
      onAct: function (act) {
        if (act === 'do-install' && deferredInstall) {
          deferredInstall.prompt();
          deferredInstall.userChoice.finally(function () { deferredInstall = null; UI.closeModal(); });
        }
      }
    });
  }

  function aboutDialog() {
    UI.modal({
      title: 'ℹ️ راهنمای مرغینو',
      body:
        '<div class="card"><h3>👷 کارگر چه کار می‌کند؟</h3><p class="tiny">' +
          'هر روز دو دکمه: «تلفات امروز» و «دان امروز». هفته‌ای یک‌بار هم «وزن‌کشی». همین.</p></div>' +
        '<div class="card"><h3>👨‍💼 مدیر چه کار می‌کند؟</h3><p class="tiny">' +
          'تعریف دوره، ثبت هزینه‌ها، تعیین تاریخ واکسن، وارد کردن فی روز مرغ و دیدن سود دوره.</p></div>' +
        '<div class="card"><h3>🧮 نرخ تبدیل چطور حساب می‌شود؟</h3><p class="tiny">' +
          'کل دان مصرفی ÷ تعداد جوجه‌ی زنده = دان هر مرغ<br>' +
          'دان هر مرغ ÷ میانگین وزن (کیلوگرم) = نرخ تبدیل<br>' +
          'تعداد زنده = تعداد کل گله − کل تلفات</p></div>' +
        '<div class="card"><h3>💾 اطلاعات کجاست؟</h3><p class="tiny">' +
          'روی همین دستگاه. اینترنت لازم نیست. برای اطمینان، از منو فایل پشتیبان بگیرید.</p></div>',
      footer: '<button class="btn ghost" data-act="close-modal">بستن</button>'
    });
  }

  function userDialog() {
    var isManager = Store.isManager();
    UI.modal({
      title: '👤 کاربر',
      body: '<div class="alert info"><span class="ico">' + (isManager ? '👨‍💼' : '👷') + '</span>' +
        '<div class="body"><div class="t">' + (isManager ? 'مدیر' : 'کارگر') + '</div>' +
        '<div class="s">' + (isManager ? 'به همه‌ی بخش‌ها دسترسی دارید.' : 'به بخش هزینه‌ها دسترسی ندارید.') + '</div></div></div>' +
        '<div class="drawer-list">' +
          '<button class="drawer-item" data-act="switch-user"><span class="ico">🔁</span><span class="grow">تعویض کاربر</span></button>' +
          '<button class="drawer-item" data-act="logout"><span class="ico">🚪</span><span class="grow">خروج</span></button>' +
        '</div>',
      footer: null
    });
  }

  /* ================= جمع‌بندی ================= */

  function saveSummary(rating) {
    var cycle = Store.activeCycle();
    var s = cycle.summary || (cycle.summary = {});
    $$('[data-sum]').forEach(function (t) { s[t.getAttribute('data-sum')] = t.value; });
    if (rating != null) s.rating = rating;
    Store.save();
  }

  /* ================= اعلان‌ها ================= */

  function maybeAskNotifications() {
    if (localStorage.getItem('morghino.askedNotif')) return;
    if (Notify.permission() !== 'default') return;
    if (!Store.activeCycle()) return;
    localStorage.setItem('morghino.askedNotif', '1');
    setTimeout(function () {
      UI.modal({
        title: '🔔 یادآوری‌ها',
        body: '<p>می‌خواهید هر روز برای ثبت تلفات و دان، و هر هفته برای وزن‌کشی، یادآوری بگیرید؟</p>',
        footer: '<button class="btn ghost" data-act="close-modal">بعداً</button>' +
                '<button class="btn" data-act="modal-ok">بله</button>',
        onOk: function () {
          Notify.requestPermission().then(function (p) {
            UI.closeModal();
            UI.toast(p === 'granted' ? 'یادآوری فعال شد ✅' : 'باشد، بعداً می‌توانید از منو فعال کنید');
          });
        }
      });
    }, 800);
  }

  /* ================= رویدادها ================= */

  var actions = {
    'reminder': function (btn) {
      var t = btn.getAttribute('data-target');
      if (t === 'mortality') Dialogs.mortality();
      else if (t === 'feed') Dialogs.feed();
      else if (t === 'weight') Dialogs.weight();
      else if (t === 'vaccine') UI.toast('تاریخ واکسن نزدیک است');
    },
    'mortality': function () { Dialogs.mortality(); },
    'feed': function () { Dialogs.feed(); },
    'weight': function () { Dialogs.weight(); },
    'weight-edit': function (btn) { Dialogs.weight(btn.getAttribute('data-id')); },
    'day-edit': function (btn) { Dialogs.day(btn.getAttribute('data-date')); },
    'fcr-date': function () { Dialogs.fcrDate(); },
    'vaccine-add': function () { Dialogs.vaccine(); },
    'vaccine-edit': function (btn) { Dialogs.vaccine(btn.getAttribute('data-id')); },
    'vaccine-done': function (btn) {
      Store.upsert('vaccines', { id: btn.getAttribute('data-id'), done: true });
      Dialogs.refresh('واکسن انجام‌شده ثبت شد ✅');
    },
    'expense-add': function () { Dialogs.expense(); },
    'cat-open': function (btn) { Dialogs.category(btn.getAttribute('data-cat')); },
    'sale-edit': function () { Dialogs.sale(); },
    'cycle-new': function () { cycleWizard(false); },
    'cycle-edit': function () { cycleWizard(true); },
    'cycles': function () { cyclesDialog(); },
    'settings': function () { settingsDialog(); },
    'notif': function () { notifDialog(); },
    'backup': function () { backupDialog(); },
    'install': function () { installDialog(); },
    'about': function () { aboutDialog(); },
    'switch-user': function () { UI.closeModal(); Store.logout(); showLogin(); },
    'logout': function () { UI.closeModal(); Store.logout(); showLogin(); },
    'summary-save': function () { saveSummary(); UI.toast('جمع‌بندی ذخیره شد ✅'); },
    'rate': function (btn) { saveSummary(+btn.getAttribute('data-v')); render(); },
    'print': function () { window.print(); },
    'share': function () {
      var txt = Views.reportText(Store.activeCycle(), Store.isManager());
      if (navigator.share) navigator.share({ title: 'گزارش مرغینو', text: txt }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { UI.toast('گزارش کپی شد ✅'); });
      else UI.toast('امکان اشتراک‌گذاری نیست');
    },
    'close-cycle': function () {
      UI.confirmBox('بستن دوره', 'دوره بسته شود؟ بعد از آن فقط برای مطالعه باقی می‌ماند.', function () {
        Store.activeCycle().status = 'closed';
        Store.save();
        Dialogs.refresh('دوره بسته شد');
      }, 'بله، ببند');
    }
  };

  function handleAction(ev) {
    var btn = ev.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    if (actions[act]) {
      ev.preventDefault();
      actions[act](btn);
    }
  }

  function bindApp() {
    $('#view').addEventListener('click', handleAction);
    $('#modal-root').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      // فقط کارهای منو در پنجره‌ها اجرا می‌شوند؛ بقیه را خود پنجره مدیریت می‌کند
      if (['cycle-new', 'cycle-edit', 'cycles', 'settings', 'notif', 'backup', 'install',
           'about', 'switch-user', 'logout', 'vaccine-add'].indexOf(act) >= 0) {
        ev.preventDefault();
        UI.closeModal();
        actions[act](btn);
      }
    });

    $('#btn-menu').addEventListener('click', menuDialog);
    $('#btn-role').addEventListener('click', userDialog);

    $('#tabbar').addEventListener('click', function (ev) {
      var t = ev.target.closest('.tab');
      if (!t) return;
      UI.state.tab = t.getAttribute('data-tab');
      render();
    });

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredInstall = e;
    });
  }

  /* ================= شروع ================= */

  function init() {
    Store.load();
    bindLogin();
    bindApp();

    if (Store.session()) showApp();
    else showLogin();

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function (e) {
          console.warn('ثبت سرویس‌ورکر ناموفق بود', e);
        });
      });
    }
  }

  global.App = { render: render, init: init, showLogin: showLogin };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
