// Service worker: casca do app em cache (abre na hora, até sem rede) e o vocabulário
// guardado depois da primeira visita. Dados do Firebase NÃO passam por aqui (o SDK tem cache próprio).
const VERSAO = 'trampo-v1';
const CASCA = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest', 'img/icone.svg', 'img/icone-192.png',
  'js/app.js', 'js/ui.js', 'js/dados.js', 'js/componentes.js', 'js/motor.js',
  'data/categorias.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(CASCA)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const mesmaOrigem = url.origin === location.origin;
  const sdk = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  if (!mesmaOrigem && !sdk) return;
  // Arquivos grandes e versionados (vocabulário, funil, SDK): cache primeiro.
  if (sdk || /\/data\//.test(url.pathname)) {
    e.respondWith(caches.open(VERSAO).then(async c => {
      const r = await c.match(e.request);
      if (r) return r;
      const n = await fetch(e.request);
      if (n.ok) c.put(e.request, n.clone());
      return n;
    }));
    return;
  }
  // Código do app: rede primeiro (pega a versão nova), cache se estiver sem rede.
  e.respondWith(fetch(e.request).then(n => {
    if (n.ok) caches.open(VERSAO).then(c => c.put(e.request, n.clone()));
    return n;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
