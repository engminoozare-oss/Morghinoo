/* مرغینو — سرویس همگام‌سازی
 *
 * یک سرویس کوچک و بدون وابستگی که داده‌ی هر مرغداری را نگه می‌دارد تا
 * گوشی کارگر و گوشی مدیر همدیگر را ببینند.
 *
 * داده روی دیسک در فایل‌های JSON ذخیره می‌شود (حجمش برای یک مرغداری
 * ناچیز است) و نوشتن اتمیک انجام می‌گیرد: اول فایل موقت، بعد rename؛
 * این‌طور اگر وسط نوشتن برق برود، فایل قبلی سالم می‌ماند.
 *
 * اجرا:  node server.js
 * تنظیم: PORT (پیش‌فرض 3000) و DATA_DIR (پیش‌فرض ./data)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
// منطق ادغام یکی است و از همان فایلی خوانده می‌شود که مرورگر هم استفاده می‌کند،
// تا قانون ادغام در سرور و گوشی هیچ‌وقت از هم جدا نیفتد.
const Merge = (function () {
  try { return require('../js/merge.js'); }      // وقتی کل پروژه بالا رفته باشد
  catch (e) { return require('./merge.js'); }    // وقتی فقط پوشه‌ی server کپی شده باشد
})();

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const MAX_BODY = 4 * 1024 * 1024;          // ۴ مگابایت، خیلی بیشتر از نیاز یک دوره
const CLOCK_TOLERANCE = 5 * 60 * 1000;     // ساعت دستگاه‌ها ممکن است کمی جلو باشد

fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------------- ذخیره‌سازی ---------------- */

const cache = new Map();

function farmPath(id) {
  return path.join(DATA_DIR, id + '.json');
}

function validId(id) {
  return typeof id === 'string' && /^[A-Z0-9-]{8,32}$/.test(id);
}

function loadFarm(id) {
  if (cache.has(id)) return cache.get(id);
  try {
    const farm = JSON.parse(fs.readFileSync(farmPath(id), 'utf8'));
    cache.set(id, farm);
    return farm;
  } catch (e) {
    return null;
  }
}

function saveFarm(farm) {
  cache.set(farm.id, farm);
  const file = farmPath(farm.id);
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(farm));
  fs.renameSync(tmp, file);                 // جایگزینی اتمیک
}

/* ---------------- رمزها ---------------- */

function hashPin(pin, salt) {
  return crypto.createHash('sha256').update(salt + ':' + String(pin)).digest('hex');
}

function newFarmId() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // بدون حرف‌های شبیه هم (I/O/0/1)
  let out = 'MRG-';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    if (i === 4) out += '-';
    out += abc[bytes[i] % abc.length];
  }
  return out;
}

/* ---------------- محدودیت تلاش برای رمز ---------------- */

const attempts = new Map();

function tooManyAttempts(key) {
  const rec = attempts.get(key);
  if (!rec) return false;
  if (Date.now() - rec.at > 10 * 60 * 1000) { attempts.delete(key); return false; }
  return rec.n >= 10;
}

function noteFailure(key) {
  const rec = attempts.get(key) || { n: 0, at: Date.now() };
  rec.n += 1;
  rec.at = Date.now();
  attempts.set(key, rec);
}

/* ---------------- کمک‌کارهای HTTP ---------------- */

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too-large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(new Error('bad-json')); }
    });
    req.on('error', reject);
  });
}

/** ساعت دستگاه‌ها ممکن است اشتباه باشد؛ زمان‌های خیلی جلوتر را کوتاه می‌کنیم */
function clampStamps(cycles) {
  const limit = Date.now() + CLOCK_TOLERANCE;
  const fix = (o) => {
    if (o && typeof o === 'object' && Number(o.updatedAt) > limit) o.updatedAt = limit;
  };
  (cycles || []).forEach((c) => {
    fix(c);
    Merge.OBJECTS.forEach((k) => fix(c[k]));
    Merge.LISTS.forEach((k) => (c[k] || []).forEach(fix));
  });
  return cycles;
}

/* ---------------- مسیرها ---------------- */

/** ساخت مرغداری تازه: کد مرغداری و رمزها را می‌گیرد/می‌سازد */
async function createFarm(req, res) {
  const body = await readBody(req);
  const managerPin = String(body.managerPin || '').trim();
  const workerPin = String(body.workerPin || '').trim();

  if (!/^\d{4}$/.test(managerPin) || !/^\d{4}$/.test(workerPin)) {
    return send(res, 400, { error: 'pin', message: 'رمز مدیر و کارگر باید ۴ رقم باشد.' });
  }
  if (managerPin === workerPin) {
    return send(res, 400, { error: 'pin', message: 'رمز مدیر و کارگر نباید یکی باشد.' });
  }

  let id = newFarmId();
  while (loadFarm(id)) id = newFarmId();

  const salt = crypto.randomBytes(16).toString('hex');
  const farm = {
    id,
    name: String(body.name || 'مرغداری').slice(0, 60),
    salt,
    managerPin: hashPin(managerPin, salt),
    workerPin: hashPin(workerPin, salt),
    cycles: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  saveFarm(farm);
  return send(res, 200, { farmId: id, name: farm.name, serverTime: Date.now() });
}

/** همگام‌سازی: تغییرهای دستگاه را می‌گیرد، ادغام می‌کند و تغییرهای تازه را برمی‌گرداند */
async function sync(req, res) {
  const body = await readBody(req);
  const farmId = String(body.farmId || '').toUpperCase();
  const pin = String(body.pin || '');
  const since = Number(body.since) || 0;

  if (!validId(farmId)) {
    return send(res, 400, { error: 'farm', message: 'کد مرغداری درست نیست.' });
  }

  const key = farmId + '|' + (req.socket.remoteAddress || '');
  if (tooManyAttempts(key)) {
    return send(res, 429, { error: 'locked', message: 'تلاش زیاد برای ورود. چند دقیقه صبر کنید.' });
  }

  const farm = loadFarm(farmId);
  if (!farm) {
    noteFailure(key);
    return send(res, 404, { error: 'farm', message: 'مرغداری با این کد پیدا نشد.' });
  }

  const hash = hashPin(pin, farm.salt);
  const role = hash === farm.managerPin ? 'manager'
             : hash === farm.workerPin ? 'worker' : null;
  if (!role) {
    noteFailure(key);
    return send(res, 403, { error: 'pin', message: 'رمز درست نیست.' });
  }
  attempts.delete(key);

  // تغییرهای دستگاه را ادغام کن
  const incoming = clampStamps(Array.isArray(body.cycles) ? body.cycles : []);
  if (incoming.length) {
    farm.cycles = Merge.mergeCycles(farm.cycles, incoming);
    farm.updatedAt = Date.now();
    saveFarm(farm);
  }

  // فقط چیزی که بعد از آخرین همگام‌سازیِ این دستگاه عوض شده برگردد
  const changed = Merge.changedSince(farm.cycles, since);
  return send(res, 200, {
    role,
    farmName: farm.name,
    cycles: changed,
    stamp: Merge.latestStamp(farm.cycles),
    serverTime: Date.now()
  });
}

/* ---------------- سرور ---------------- */

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  const url = (req.url || '').split('?')[0];

  try {
    if (url === '/api/health') return send(res, 200, { ok: true, time: Date.now() });
    if (url === '/api/farm' && req.method === 'POST') return await createFarm(req, res);
    if (url === '/api/sync' && req.method === 'POST') return await sync(req, res);
    return send(res, 404, { error: 'not-found' });
  } catch (e) {
    const known = e && (e.message === 'bad-json' || e.message === 'too-large');
    if (!known) console.error('خطای سرور:', e);
    return send(res, known ? 400 : 500, { error: known ? e.message : 'server' });
  }
});

server.listen(PORT, () => {
  console.log('مرغینو — سرویس همگام‌سازی روی پورت ' + PORT + ' بالا آمد (داده: ' + DATA_DIR + ')');
});
