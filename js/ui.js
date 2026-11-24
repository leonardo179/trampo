// Peças de interface reaproveitadas por todas as telas. Sem framework: DOM direto, pequeno e rápido.

/** Cria elemento. h('div.cartao#x', {onclick}, filhos...) */
export function h(tag, props, ...filhos) {
  const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(tag) || [];
  const el = document.createElement(m[1] || 'div');
  for (const p of (m[2] || '').match(/[.#][\w-]+/g) || []) {
    if (p[0] === '.') el.classList.add(p.slice(1)); else el.id = p.slice(1);
  }
  // Segundo argumento que não é objeto de propriedades é filho (inclusive 0 e '').
  if (props === null || typeof props !== 'object' || props instanceof Node || Array.isArray(props)) {
    if (props !== undefined) filhos.unshift(props);
    props = null;
  }
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'class') el.className += ' ' + v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  anexar(el, filhos);
  return el;
}
function anexar(el, filhos) {
  for (const f of filhos) {
    if (f == null || f === false) continue;
    if (Array.isArray(f)) anexar(el, f);
    else el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
}

// ------------------------------------------------------------------ ícones (traço, estilo Lucide)
const P = {
  casa: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
  mural: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  coracao: '<path d="M12 20s-7-4.4-9.2-8.6C1.2 8.2 3.2 4.5 6.8 4.5c2 0 3.4 1.1 4.2 2.3.8-1.2 2.2-2.3 4.2-2.3 3.6 0 5.6 3.7 4 6.9C19 15.6 12 20 12 20Z"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12Z"/>',
  lupa: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  seta_cima: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  voltar: '<path d="M15 18 9 12l6-6"/>',
  direita: '<path d="m9 18 6-6-6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  estrela: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/>',
  local: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  zap: '<path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3 3Z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2.1-2.1l.8-1-1-2Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  verif: '<path d="m12 2.5 2.4 1.8 3-.2.9 2.9 2.4 1.8-1 2.8 1 2.8-2.4 1.8-.9 2.9-3-.2L12 21.5l-2.4-1.8-3 .2-.9-2.9-2.4-1.8 1-2.8-1-2.8 2.4-1.8.9-2.9 3 .2Z"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  raio: '<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>',
  escudo: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  sair: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  compartilhar: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  filtro: '<path d="M4 5h16M7 12h10M10 19h4"/>',
  pata: '<circle cx="5.5" cy="10" r="2"/><circle cx="9.5" cy="5.5" r="2"/><circle cx="14.5" cy="5.5" r="2"/><circle cx="18.5" cy="10" r="2"/><path d="M12 12c-3 0-5.5 3.5-5.5 6 0 1.5 1.2 2 2.5 2 1.2 0 2-.6 3-.6s1.8.6 3 .6c1.3 0 2.5-.5 2.5-2 0-2.5-2.5-6-5.5-6Z"/>',
  enviar: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z"/>',
  carteira: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M16 13h2M3 10h18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  maleta: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  baixar: '<path d="M12 4v12M6 10l6 6 6-6M5 20h14"/>',
  lua: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
};
export function icone(nome, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'i ' + cls);
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = P[nome] || '';
  return s;
}

// ------------------------------------------------------------------ toasts
export function toast(texto, tipo = '') {
  const t = h('div.toast', { class: tipo }, tipo === 'ok' ? icone('check', 'p') : null, texto);
  document.getElementById('toasts').append(t);
  setTimeout(() => { t.style.transition = 'opacity .25s'; t.style.opacity = '0'; }, 2800);
  setTimeout(() => t.remove(), 3100);
}

// ------------------------------------------------------------------ folha (bottom sheet / diálogo)
export function folha(conteudo, { aoFechar } = {}) {
  const camada = document.getElementById('camada');
  const anterior = document.activeElement;
  const caixa = h('div.folha', { role: 'dialog', 'aria-modal': 'true' });
  const fundo = h('div.fundo-escuro', {
    onclick: e => { if (e.target === fundo) fechar(); }
  }, caixa);
  function tecla(e) { if (e.key === 'Escape') fechar(); }
  function fechar() {
    document.removeEventListener('keydown', tecla);
    fundo.remove();
    document.body.style.overflow = '';
    anterior?.focus?.();
    aoFechar?.();
  }
  caixa.append(...[].concat(typeof conteudo === 'function' ? conteudo(fechar) : conteudo));
  camada.append(fundo);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', tecla);
  setTimeout(() => caixa.querySelector('input,button,textarea')?.focus({ preventScroll: true }), 30);
  return fechar;
}

export function confirmar(titulo, texto, rotuloSim = 'Confirmar') {
  return new Promise(res => {
    let r = false;
    folha(fechar => [
      h('h2', titulo), h('p.sub', texto),
      h('div.acoes',
        h('button.botao.sec', { onclick: () => fechar() }, 'Cancelar'),
        h('button.botao', { onclick: () => { r = true; fechar(); } }, rotuloSim))
    ], { aoFechar: () => res(r) });
  });
}

export function visorDeImagem(url, legenda = '') {
  const v = h('div.visor', { onclick: () => v.remove(), role: 'dialog' },
    h('img', { src: url, alt: legenda }),
    h('button.botao-redondo.fechar', { 'aria-label': 'Fechar' }, icone('x')),
    legenda ? h('div.legenda', legenda) : null);
  document.getElementById('camada').append(v);
}

// ------------------------------------------------------------------ formatação
const corDeNome = ['#7C5CFF', '#22B893', '#F59E0B', '#EC4899', '#3B82F6', '#EF4444', '#8B5CF6', '#14B8A6'];
export function avatar(nome, url, cls = '', online = false) {
  const iniciais = (nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  let soma = 0; for (const c of nome || '') soma = (soma * 31 + c.charCodeAt(0)) | 0;
  const a = h('div.avatar', { class: cls, style: { background: corDeNome[Math.abs(soma) % corDeNome.length] } });
  if (url) {
    const img = h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async' });
    img.onerror = () => { img.remove(); a.prepend(iniciais); };
    a.append(img);
  } else a.append(iniciais);
  if (online) a.append(h('span.on', { title: 'Ativo agora' }));
  return a;
}

export const reais = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v % 1 ? 2 : 0 });
export const nota1 = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function tempoAtras(ms) {
  if (!ms) return '';
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d === 1) return 'ontem';
  if (d < 30) return `há ${d} dias`;
  const m = Math.floor(d / 30);
  return m < 12 ? `há ${m} ${m === 1 ? 'mês' : 'meses'}` : `há ${Math.floor(m / 12)} ano${m >= 24 ? 's' : ''}`;
}
export function hora(ms) {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
export function diaRotulo(ms) {
  const d = new Date(ms), hoje = new Date();
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}

export function botaoCarregando(botao, promessa) {
  const original = [...botao.childNodes];
  botao.disabled = true;
  botao.replaceChildren(h('span.gira'));
  return Promise.resolve(promessa).finally(() => { botao.disabled = false; botao.replaceChildren(...original); });
}

/** Debounce simples. */
export function atrasar(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Avisa quando o elemento entra na tela (carregar mais / imagens). */
export function aoAparecer(el, fn) {
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: '400px' });
  io.observe(el);
}

export function esqueletos(n = 4) {
  return h('div.lista.grade-2', Array.from({ length: n }, () => h('div.esq.esq-prest')));
}

export function vazio(emo, titulo, texto, acao) {
  return h('div.vazio', h('div.emo', emo), h('h3', titulo), h('p', texto), acao || null);
}
