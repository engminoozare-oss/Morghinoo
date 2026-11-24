/* مرغینو — همگام‌سازی با سرور
 *
 * برنامه بدون سرور هم کامل کار می‌کند؛ این بخش فقط وقتی روشن می‌شود که
 * مدیر آدرس سرور و کد مرغداری را وارد کرده باشد.
 *
 * روش کار ساده است: هر بار یک درخواست می‌رود که هم تغییرهای این دستگاه را
 * می‌برد و هم تغییرهای دستگاه دیگر را می‌آورد. اگر اینترنت نبود، چیزی خراب
 * نمی‌شود — ثبت‌ها روی گوشی می‌مانند و دفعه‌ی بعد که شبکه وصل شد می‌روند.
 */
(function (global) {
  'use strict';

  var Store = global.Store, Merge = global.Merge;

  var PERIOD = 60000;        // هر یک دقیقه یک‌بار در حالت عادی
  var RETRY = 15000;         // بعد از خطا زودتر دوباره امتحان می‌کند
  var state = {
    status: 'off',           // off | syncing | ok | offline | error
    message: '',
    lastOk: 0,
    role: ''
  };

  var timer = null;
  var inFlight = false;
  var pendingSave = false;
  var listeners = [];

  function onChange(fn) { listeners.push(fn); }

  function setStatus(status, message) {
    state.status = status;
    state.message = message || '';
    listeners.forEach(function (fn) { fn(state); });
  }

  function config() {
    var s = Store.get();
    if (!s.sync) s.sync = { url: '', farmId: '', stamp: 0, lastAt: 0 };
    return s.sync;
  }

  function isOn() {
    var c = config();
    return !!(c.url && c.farmId);
  }

  function apiUrl(path) {
    var base = String(config().url || '').trim().replace(/\/+$/, '');
    return base + path;
  }

  function request(path, body, timeoutMs) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || 20000);
    return fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      clearTimeout(t);
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.message || 'خطای سرور');
          err.code = data.error || res.status;
          throw err;
        }
        return data;
      });
    }, function (e) {
      clearTimeout(t);
      var err = new Error('به سرور وصل نشد');
      err.offline = true;
      err.cause = e;
      throw err;
    });
  }

  /** ساخت مرغداری تازه روی سرور؛ کد مرغداری برمی‌گردد */
  function createFarm(url, name, managerPin, workerPin) {
    var c = config();
    c.url = String(url || '').trim().replace(/\/+$/, '');
    Store.save();
    return request('/api/farm', { name: name, managerPin: managerPin, workerPin: workerPin })
      .then(function (data) {
        c.farmId = data.farmId;
        c.stamp = 0;
        Store.save();
        return data;
      });
  }

  /** یک رفت‌وبرگشت کامل: تغییرهای ما می‌رود، تغییرهای آن‌ها می‌آید */
  function run(opts) {
    opts = opts || {};
    if (!isOn()) { setStatus('off'); return Promise.resolve(false); }
    if (inFlight) { pendingSave = true; return Promise.resolve(false); }

    var session = Store.session();
    if (!session) { setStatus('off'); return Promise.resolve(false); }

    var s = Store.get();
    var c = config();
    var pin = session.role === 'manager' ? s.settings.managerPin : s.settings.workerPin;

    inFlight = true;
    setStatus('syncing');

    // فقط دوره‌هایی که از آخرین همگام‌سازی موفق عوض شده‌اند فرستاده می‌شوند
    var outgoing = opts.full ? s.cycles : Merge.changedSince(s.cycles, c.lastAt);

    return request('/api/sync', {
      farmId: c.farmId,
      pin: pin,
      since: opts.full ? 0 : c.stamp,
      cycles: outgoing
    }).then(function (data) {
      var before = JSON.stringify(s.cycles);
      if (data.cycles && data.cycles.length) {
        s.cycles = Merge.mergeCycles(s.cycles, data.cycles);
        if (!s.activeCycleId && s.cycles.length) s.activeCycleId = s.cycles[0].id;
      }
      c.stamp = Number(data.stamp) || c.stamp;
      c.lastAt = Date.now();
      state.role = data.role || '';
      state.lastOk = Date.now();
      Store.save();

      inFlight = false;
      setStatus('ok');
      schedule(PERIOD);

      var changed = JSON.stringify(s.cycles) !== before;
      if (pendingSave) { pendingSave = false; setTimeout(function () { run(); }, 500); }
      if (changed && opts.onData) opts.onData();
      return changed;
    }, function (err) {
      inFlight = false;
      pendingSave = false;
      if (err.offline) {
        setStatus('offline', 'اینترنت وصل نیست — ثبت‌ها روی گوشی می‌مانند');
      } else {
        setStatus('error', err.message || 'همگام‌سازی ناموفق بود');
      }
      schedule(RETRY);
      return false;
    });
  }

  function schedule(ms) {
    clearTimeout(timer);
    if (!isOn()) return;
    timer = setTimeout(function () { run({ onData: notifyData }); }, ms);
  }

  var dataListener = null;
  function notifyData() { if (dataListener) dataListener(); }

  var started = false;

  /** شروع همگام‌سازی خودکار؛ onData وقتی صدا می‌شود که داده‌ی تازه رسیده باشد */
  function start(onData) {
    dataListener = onData || null;

    /* شنونده‌ها همیشه نصب می‌شوند، حتی اگر هنوز سروری تنظیم نشده باشد؛
       وگرنه کاربری که بعد از ورود سرور را وصل می‌کند، تا بستن و باز کردن
       دوباره‌ی برنامه هیچ‌وقت خودکار همگام نمی‌شد. */
    if (!started) {
      started = true;

      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) run({ onData: notifyData });
      });
      window.addEventListener('online', function () { run({ onData: notifyData }); });

      // بعد از هر تغییر روی این گوشی، کمی صبر و بعد ارسال
      var saveTimer = null;
      Store.onChange(function () {
        if (!isOn()) return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () { run({ onData: notifyData }); }, 2500);
      });
    }

    if (isOn()) run({ onData: notifyData });
    else setStatus('off');
  }

  function disconnect() {
    var c = config();
    c.url = '';
    c.farmId = '';
    c.stamp = 0;
    c.lastAt = 0;
    Store.save();
    clearTimeout(timer);
    setStatus('off');
  }

  global.Sync = {
    state: state,
    isOn: isOn,
    config: config,
    createFarm: createFarm,
    run: run,
    start: start,
    disconnect: disconnect,
    onChange: onChange,
    request: request
  };
})(window);
