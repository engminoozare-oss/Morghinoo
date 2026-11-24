/* مرغینو — لایه‌ی داده
 * همه‌چیز روی همین دستگاه در localStorage نگهداری می‌شود؛ نیازی به اینترنت نیست.
 */
(function (global) {
  'use strict';

  var KEY = 'morghino.state.v1';
  var SESSION_KEY = 'morghino.session';

  /* دسته‌بندی هزینه‌ها؛ ترتیب همین‌جا ترتیب نمایش در صفحه است */
  var CATEGORIES = [
    { id: 'chick',       label: 'خرید جوجه',  icon: '🐣', unit: 'قطعه' },
    { id: 'starter',     label: 'پیش‌دانه',    icon: '🥣', unit: 'کیلوگرم' },
    { id: 'corn',        label: 'ذرت',        icon: '🌽', unit: 'کیلوگرم' },
    { id: 'soy',         label: 'سویا',       icon: '🫘', unit: 'کیلوگرم' },
    { id: 'concentrate', label: 'کنسانتره',   icon: '🧪', unit: 'کیلوگرم' },
    { id: 'drug',        label: 'دارو',       icon: '💊', unit: 'مورد' },
    { id: 'vaccine',     label: 'واکسن',      icon: '💉', unit: 'دوز' },
    { id: 'transport',   label: 'حمل و نقل',  icon: '🚚', unit: 'سرویس' },
    { id: 'rent',        label: 'اجاره',      icon: '🏠', unit: 'ماه' },
    { id: 'repair',      label: 'تعمیرات',    icon: '🔧', unit: 'مورد' },
    { id: 'bills',       label: 'قبوض',       icon: '🧾', unit: 'مورد' },
    { id: 'worker',      label: 'کارگر',      icon: '👷', unit: 'مورد' },
    { id: 'misc',        label: 'متفرقه',     icon: '📦', unit: 'مورد' }
  ];

  /* دسته‌هایی که دیگر جدا نیستند و زیرمجموعه‌ی «متفرقه» شده‌اند.
     هزینه‌های قبلی پاک نمی‌شوند؛ به متفرقه منتقل و نامشان در توضیح نوشته می‌شود. */
  var MERGED_INTO_MISC = { salt: 'نمک', paper: 'کاغذ بستر' };

  /* دانه‌هایی که در محاسبه‌ی «دان مصرفی» به‌عنوان خوراک حساب می‌شوند */
  var FEED_CATEGORIES = ['starter', 'corn', 'soy', 'concentrate'];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function defaultState() {
    return {
      version: 2,
      settings: {
        managerPin: '1234',
        workerPin: '1111',
        farmName: 'مرغداری من',
        reminderHour: 17,          // ساعت یادآوری روزانه
        notifications: true
      },
      activeCycleId: null,
      cycles: []
    };
  }

  function newCycle(data) {
    return {
      id: uid(),
      name: data.name || 'دوره جدید',
      createdAt: new Date().toISOString(),
      status: 'active',
      start: {
        entryDate: data.entryDate,           // تاریخ ورود جوجه (میلادی ISO)
        breed: data.breed || '',             // نژاد
        company: data.company || '',         // شرکت جوجه
        initialWeight: num(data.initialWeight), // وزن اولیه به گرم
        flockCount: num(data.flockCount),    // تعداد گله
        durationDays: num(data.durationDays) || 90
      },
      expenses: [],                          // {id, cat, qty, unitPrice, total, date, note}
      mortality: [],                         // {id, date, count, note}
      feed: [],                              // {id, date, kg, note}
      weights: [],                           // {id, date, avgWeight (گرم), sample, note}
      vaccines: [],                          // {id, name, date, done, note}
      sale: { pricePerKg: 0, extraIncome: 0, soldCount: null, note: '', date: null },
      summary: { breed: '', vaccine: '', worker: '', feed: '', general: '', rating: 0 }
    };
  }

  /* ارقام فارسی، جداکننده‌ی هزارگان و علامت اعشار همگی پذیرفته می‌شوند */
  function num(v) {
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    return global.J.parseNum(v);
  }

  var state = null;
  var listeners = [];

  /** داده‌های ساخته‌شده با نسخه‌های قبلی برنامه را به ساختار امروز می‌آورد */
  function migrate(s) {
    var changed = false;
    if (!(s.version >= 2)) {
      s.cycles.forEach(function (c) {
        (c.expenses || []).forEach(function (e) {
          var oldLabel = MERGED_INTO_MISC[e.cat];
          if (!oldLabel) return;
          e.note = oldLabel + (e.note ? ' — ' + e.note : '');
          e.cat = 'misc';
          changed = true;
        });
      });
      s.version = 2;
      changed = true;
    }
    return changed;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      state = raw ? JSON.parse(raw) : defaultState();
    } catch (e) {
      console.warn('خواندن داده‌ها ناموفق بود، از حالت پیش‌فرض شروع می‌کنیم', e);
      state = defaultState();
    }
    if (!state.settings) state.settings = defaultState().settings;
    if (!Array.isArray(state.cycles)) state.cycles = [];
    if (migrate(state)) save();
    return state;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      alert('ذخیره‌سازی ناموفق بود. حافظه‌ی دستگاه پر است؟');
    }
    listeners.forEach(function (fn) { fn(state); });
  }

  function onChange(fn) { listeners.push(fn); }

  function get() { return state || load(); }

  function activeCycle() {
    var s = get();
    return s.cycles.filter(function (c) { return c.id === s.activeCycleId; })[0] || null;
  }

  function addCycle(data) {
    var s = get();
    var c = newCycle(data);
    s.cycles.push(c);
    s.activeCycleId = c.id;
    save();
    return c;
  }

  function setActiveCycle(id) { get().activeCycleId = id; save(); }

  function deleteCycle(id) {
    var s = get();
    s.cycles = s.cycles.filter(function (c) { return c.id !== id; });
    if (s.activeCycleId === id) s.activeCycleId = s.cycles.length ? s.cycles[0].id : null;
    save();
  }

  /* ---------- رکوردهای یک دوره ---------- */

  /** یک رکورد را در لیست مشخص اضافه یا (اگر id داشته باشد) به‌روزرسانی می‌کند */
  function upsert(listName, rec) {
    var c = activeCycle();
    if (!c) return null;
    if (!Array.isArray(c[listName])) c[listName] = [];
    if (rec.id) {
      for (var i = 0; i < c[listName].length; i++) {
        if (c[listName][i].id === rec.id) {
          c[listName][i] = Object.assign({}, c[listName][i], rec);
          save();
          return c[listName][i];
        }
      }
    }
    rec.id = rec.id || uid();
    c[listName].push(rec);
    save();
    return rec;
  }

  function remove(listName, id) {
    var c = activeCycle();
    if (!c) return;
    c[listName] = (c[listName] || []).filter(function (r) { return r.id !== id; });
    save();
  }

  /** رکورد روزانه‌ی یک تاریخ (تلفات/دان) — برای هر روز فقط یک رکورد نگه می‌داریم */
  function byDate(listName, date) {
    var c = activeCycle();
    if (!c) return null;
    return (c[listName] || []).filter(function (r) { return r.date === date; })[0] || null;
  }

  function setDaily(listName, date, fields) {
    var existing = byDate(listName, date);
    var rec = Object.assign({ date: date }, fields);
    if (existing) rec.id = existing.id;
    return upsert(listName, rec);
  }

  /* ---------- ورود و نقش کاربر ---------- */

  function session() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || 'null'); }
    catch (e) { return null; }
  }

  function login(role, pin, remember) {
    var s = get();
    var expected = role === 'manager' ? s.settings.managerPin : s.settings.workerPin;
    if (String(pin) !== String(expected)) return false;
    var data = JSON.stringify({ role: role, at: Date.now() });
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, data);
    return true;
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  function isManager() {
    var s = session();
    return !!s && s.role === 'manager';
  }

  /* ---------- پشتیبان‌گیری ---------- */

  function exportJSON() { return JSON.stringify(get(), null, 2); }

  function importJSON(text) {
    var data = JSON.parse(text);
    if (!data || !Array.isArray(data.cycles)) throw new Error('فایل پشتیبان معتبر نیست');
    state = data;
    if (!state.settings) state.settings = defaultState().settings;
    migrate(state);
    save();
  }

  global.Store = {
    CATEGORIES: CATEGORIES,
    FEED_CATEGORIES: FEED_CATEGORIES,
    uid: uid,
    num: num,
    load: load,
    save: save,
    get: get,
    onChange: onChange,
    activeCycle: activeCycle,
    addCycle: addCycle,
    setActiveCycle: setActiveCycle,
    deleteCycle: deleteCycle,
    upsert: upsert,
    remove: remove,
    byDate: byDate,
    setDaily: setDaily,
    session: session,
    login: login,
    logout: logout,
    isManager: isManager,
    exportJSON: exportJSON,
    importJSON: importJSON,
    category: function (id) {
      return CATEGORIES.filter(function (c) { return c.id === id; })[0] ||
             { id: id, label: id, icon: '📦', unit: '' };
    }
  };
})(window);
