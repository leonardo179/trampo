// Portfólio do profissional: antes/depois com comparador deslizante, fotos de trabalhos com
// visor navegável e diplomas/certificados. Mesmos campos do app (fotos, antesDepois, certificados).
import { h, icone } from './ui.js';

/** Comparador: a foto "depois" no fundo, a "antes" por cima recortada até a alça. */
export function comparador(antes, depois, legenda = '') {
  const imgAntes = h('img.cmp-antes', { src: antes, alt: 'Antes', loading: 'lazy', decoding: 'async', draggable: false });
  const imgDepois = h('img', { src: depois, alt: 'Depois', loading: 'lazy', decoding: 'async', draggable: false });
  const alca = h('div.cmp-alca', h('span', icone('voltar', 'pp'), icone('direita', 'pp')));
  const faixa = h('input.cmp-faixa', { type: 'range', min: 0, max: 100, value: 50, 'aria-label': 'Comparar antes e depois' });
  const caixa = h('div.cmp', imgDepois, imgAntes, alca, faixa,
    h('span.cmp-rot.esq', 'Antes'), h('span.cmp-rot.dir', 'Depois'));
  const pos = v => { caixa.style.setProperty('--p', v + '%'); };
  faixa.addEventListener('input', () => pos(faixa.value));
  pos(50);
  // Dica de uso: na primeira vez que aparece na tela, a alça "respira" para mostrar que mexe.
  const io = new IntersectionObserver(es => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    let t = 0;
    const anima = () => { t += 1; pos(50 + Math.sin(t / 9) * 14); if (t < 57) requestAnimationFrame(anima); else pos(50); };
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(anima);
  }, { threshold: .6 });
  io.observe(caixa);
  return h('figure.cmp-fig', caixa, legenda ? h('figcaption', legenda) : null);
}

/** Visor de tela cheia com setas (teclado e toque). */
export function visor(lista, inicio = 0) {
  let i = inicio;
  const img = h('img');
  const leg = h('div.legenda');
  const cont = h('div.visor-conta');
  const pintar = () => { img.src = lista[i].url; img.alt = lista[i].legenda || ''; leg.textContent = lista[i].legenda || ''; cont.textContent = `${i + 1} / ${lista.length}`; };
  const ir = d => { i = (i + d + lista.length) % lista.length; pintar(); };
  const fechar = () => { v.remove(); document.removeEventListener('keydown', tecla); document.body.style.overflow = ''; };
  const tecla = e => { if (e.key === 'Escape') fechar(); if (e.key === 'ArrowRight') ir(1); if (e.key === 'ArrowLeft') ir(-1); };
  let x0 = null;
  const v = h('div.visor', {
    role: 'dialog', 'aria-label': 'Fotos dos trabalhos',
    onclick: e => { if (e.target === v || e.target === img) fechar(); },
    ontouchstart: e => { x0 = e.touches[0].clientX; },
    ontouchend: e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1); x0 = null; },
  }, img, leg, cont,
    h('button.botao-redondo.fechar', { 'aria-label': 'Fechar', onclick: fechar }, icone('x')),
    lista.length > 1 ? h('button.botao-redondo.visor-ant', { 'aria-label': 'Anterior', onclick: e => { e.stopPropagation(); ir(-1); } }, icone('voltar')) : null,
    lista.length > 1 ? h('button.botao-redondo.visor-prox', { 'aria-label': 'Próxima', onclick: e => { e.stopPropagation(); ir(1); } }, icone('direita')) : null);
  pintar();
  document.getElementById('camada').append(v);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', tecla);
}

/** Os blocos do perfil. Devolve null quando o profissional não tem nada para mostrar. */
export function portfolio(p) {
  const pares = (p.antesDepois || []).filter(f => f.url && f.urlDepois);
  const fotos = (p.fotos || []).filter(f => f.url && !f.urlDepois);
  const certs = (p.certificados || []).filter(c => c.url);
  if (!pares.length && !fotos.length && !certs.length) return null;
  const blocos = [];
  if (pares.length) {
    blocos.push(h('div.cartao',
      h('div.bloco-topo', h('h2', 'Antes e depois'), h('span', pares.length > 1 ? `${pares.length} trabalhos · arraste para comparar` : 'arraste para comparar')),
      h('div.pares', pares.slice(0, 6).map(f => comparador(f.url, f.urlDepois, f.legenda)))));
  }
  if (fotos.length) {
    const mostrar = fotos.slice(0, 9);
    blocos.push(h('div.cartao',
      h('div.bloco-topo', h('h2', 'Trabalhos realizados'), h('span', `${fotos.length} foto${fotos.length > 1 ? 's' : ''}`)),
      h('div.galeria', mostrar.map((f, i) => h('button', { 'aria-label': f.legenda || 'Foto do trabalho', onclick: () => visor(fotos, i) },
        h('img', { src: f.url, alt: f.legenda || '', loading: 'lazy', decoding: 'async' }),
        i === mostrar.length - 1 && fotos.length > mostrar.length ? h('span.mais-fotos', `+${fotos.length - mostrar.length}`) : null)))));
  }
  if (certs.length) {
    blocos.push(h('div.cartao',
      h('div.bloco-topo', h('h2', 'Diplomas e certificados')),
      certs.map(c => h('a.info-linha', { href: c.url, target: '_blank', rel: 'noopener', style: { color: 'inherit' } },
        icone(c.tipo === 'pdf' ? 'mural' : 'verif', 'p'), c.nome || 'Certificado', h('span', { style: { marginLeft: 'auto', color: 'var(--violeta)' } }, icone('direita', 'p'))))));
  }
  return blocos;
}
