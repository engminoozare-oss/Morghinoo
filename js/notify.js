/* مرغینو — یادآورها و اعلان‌ها
 *
 * اعلان‌ها روی خود دستگاه ساخته می‌شوند (بدون سرور). تا وقتی برنامه باز
 * باشد یا در پس‌زمینه زنده باشد، یادآورها بررسی و نمایش داده می‌شوند و
 * در هر حال روی صفحه‌ی اصلی به شکل کارت هشدار دیده می‌شوند.
 */
(function (global) {
  'use strict';

  var SENT_KEY = 'morghino.notified.v1';

  function sentLog() {
    try { return JSON.parse(localStorage.getItem(SENT_KEY) || '{}'); } catch (e) { return {}; }
  }

  function markSent(key) {
    var log = sentLog();
    log[key] = Date.now();
    // فقط ۲۰۰ کلید آخر را نگه می‌داریم
    var keys = Object.keys(log);
    if (keys.length > 200) {
      keys.sort(function (a, b) { return log[a] - log[b]; });
      keys.slice(0, keys.length - 200).forEach(function (k) { delete log[k]; });
    }
    localStorage.setItem(SENT_KEY, JSON.stringify(log));
  }

  function wasSent(key) { return !!sentLog()[key]; }

  /** فهرست یادآورهای فعال برای دوره‌ی جاری */
  function pending(cycle, role) {
    var J = global.J;
    if (!cycle || cycle.status !== 'active') return [];
    var today = J.todayISO();
    var list = [];

    if (cycle.start.entryDate && J.diffDays(cycle.start.entryDate, today) < 0) return [];

    // ۱) تلفات روزانه
    var m = global.Store.list(cycle, 'mortality').filter(function (r) { return r.date === today; })[0];
    if (!m) {
      list.push({
        key: 'mortality-' + today,
        icon: '🪶',
        title: 'ثبت تلفات امروز',
        body: 'تعداد تلفات امروز هنوز وارد نشده است.',
        tab: 'report',
        action: 'mortality',
        level: 'due',
        daily: true
      });
    }

    // ۲) دان مصرفی روزانه
    var f = global.Store.list(cycle, 'feed').filter(function (r) { return r.date === today; })[0];
    if (!f) {
      list.push({
        key: 'feed-' + today,
        icon: '🌾',
        title: 'ثبت دان امروز',
        body: 'وزن دان مصرفی امروز هنوز وارد نشده است.',
        tab: 'report',
        action: 'feed',
        level: 'due',
        daily: true
      });
    }

    // ۳) وزن‌کشی هفتگی
    var next = global.Calc.nextWeighing(cycle);
    if (next && next <= today) {
      var late = J.diffDays(next, today);
      list.push({
        key: 'weigh-' + next,
        icon: '⚖️',
        title: 'وزن‌کشی هفتگی',
        body: late > 0 ? 'وزن‌کشی این هفته ' + J.faDigits(late) + ' روز عقب افتاده است.'
                       : 'امروز روز وزن‌کشی هفتگی است.',
        tab: 'report',
        action: 'weight',
        level: 'due'
      });
    }

    // ۴) واکسن — روز قبل «فردا روز واکسن» و روز خودش «امروز روز واکسن»
    global.Store.list(cycle, 'vaccines').forEach(function (v) {
      if (v.done || !v.date) return;
      var d = J.diffDays(today, v.date); // چند روز مانده
      if (d === 1 || d === 0) {
        list.push({
          key: 'vaccine-' + v.id + '-' + today,
          id: v.id,
          icon: '💉',
          title: d === 1 ? 'فردا روز واکسن است' : 'امروز روز واکسن است',
          body: v.name + ' — ' + J.fmt(v.date),
          tab: 'report',
          action: 'vaccine',
          btn: 'باشه',
          level: d === 0 ? 'due' : 'soon'
        });
      } else if (d < 0 && role !== 'worker') {
        // واکسن عقب‌افتاده فقط به مدیر گزارش می‌شود
        list.push({
          key: 'vaccine-late-' + v.id + '-' + today,
          id: v.id,
          icon: '💉',
          title: 'واکسن عقب‌افتاده: ' + v.name,
          body: J.faDigits(-d) + ' روز از تاریخ واکسن گذشته است.',
          tab: 'report',
          action: 'vaccine',
          btn: 'باشه',
          level: 'due'
        });
      }
    });

    return list;
  }

  function permission() {
    return (typeof Notification === 'undefined') ? 'unsupported' : Notification.permission;
  }

  function requestPermission() {
    if (typeof Notification === 'undefined') return Promise.resolve('unsupported');
    return Notification.requestPermission();
  }

  function show(title, body, tag) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    var opts = {
      body: body,
      tag: tag,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      dir: 'rtl',
      lang: 'fa',
      renotify: false,
      vibrate: [120, 60, 120]
    };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(function (reg) {
        reg.showNotification(title, opts);
      }).catch(function () { try { new Notification(title, opts); } catch (e) {} });
    } else {
      try { new Notification(title, opts); } catch (e) {}
    }
  }

  /** یادآورهای سررسیده را (یک‌بار در روز برای هر مورد) اعلان می‌کند */
  function fireDue(cycle, settings) {
    if (!settings || settings.notifications === false) return;
    if (permission() !== 'granted') return;
    var hour = new Date().getHours();
    var role = global.Store.isManager() ? 'manager' : 'worker';
    pending(cycle, role).forEach(function (r) {
      // یادآورهای روزانه فقط از ساعت تنظیم‌شده به بعد اعلان می‌شوند
      if (r.daily && hour < (Number(settings.reminderHour) || 17)) return;
      if (wasSent(r.key)) return;
      show('مرغینو — ' + r.title, r.body, r.key);
      markSent(r.key);
    });
  }

  var timer = null;

  function startWatching(getCycle, getSettings) {
    function tick() { fireDue(getCycle(), getSettings()); }
    tick();
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 60000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) tick();
    });
  }

  global.Notify = {
    pending: pending,
    permission: permission,
    requestPermission: requestPermission,
    show: show,
    fireDue: fireDue,
    startWatching: startWatching
  };
})(window);
