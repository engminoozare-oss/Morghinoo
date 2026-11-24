/* مرغینو — سرویس‌ورکر: برنامه کاملاً آفلاین کار می‌کند
 *
 * ⚠️ مهم: فایل‌های js و css از حافظه خوانده می‌شوند، پس با هر تغییر در برنامه
 * باید شماره‌ی VERSION را یکی زیاد کرد؛ وگرنه دستگاه‌هایی که برنامه را نصب
 * کرده‌اند تا ابد همان نسخه‌ی قدیمی را نشان می‌دهند. با عوض شدن VERSION،
 * حافظه‌ی قبلی پاک و نسخه‌ی تازه گرفته می‌شود.
 */
var VERSION = 'morghino-v6';
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/jalali.js',
  './js/store.js',
  './js/calc.js',
  './js/notify.js',
  './js/ui.js',
  './js/views.js',
  './js/dialogs.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-256.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png',
  './icons/favicon.ico'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* شبکه‌محور برای صفحه‌ی اصلی، حافظه‌محور برای بقیه‌ی فایل‌ها */
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (r) { return r || caches.match('./'); });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
    })
  );
});

/* با کلیک روی اعلان، برنامه باز می‌شود */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) return list[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});
