// Componentes do domínio (mesmas regras de exibição do app Android).
import { h, icone, avatar, nota1, reais, toast } from './ui.js';

let CATS = null;
export async function categorias() {
  if (!CATS) {
    const lista = await fetch(new URL('../data/categorias.json', import.meta.url)).then(r => r.json());
    CATS = new Map(lista.map(c => [c.id, c]));
  }
  return CATS;
}
export const categoriaSinc = id => CATS?.get(id) || { id, nome: 'Serviços', e: '🧰', g: '' };

// Taxas: só aparecem com histórico que sustente (mesmos pisos do Prestador.kt).
const pct = (a, b) => Math.max(0, Math.min(100, Math.floor(a * 100 / b)));
export const taxaResposta = p => (p.contatosRecebidos || 0) >= 5 ? pct(p.contatosRespondidos || 0, p.contatosRecebidos) : null;
export const taxaPreco = p => (p.precosAvaliados || 0) >= 3 ? pct(p.precoCumprido || 0, p.precosAvaliados) : null;
export const taxaComparecimento = p => (p.combinados || 0) >= 3 ? pct(p.compareceu || 0, p.combinados) : null;
export const taxaRapidez = p => (p.respostasAvaliadas || 0) >= 5 ? pct(p.respondeuRapido || 0, p.respostasAvaliadas) : null;
export const tempoMedio = p => (p.respostasChat || 0) >= 3 ? Math.round(p.minutosRespostaChat / p.respostasChat) : null;
export const atendeAgora = p => p.disponivel !== false && Date.now() - (p.ultimaAtividade || 0) < 15 * 60000;
export const ausente = p => (p.ausenteAte || 0) > Date.now();

export function distanciaKm(aLat, aLng, bLat, bLng) {
  if ([aLat, aLng, bLat, bLng].some(v => v == null)) return null;
  const R = 6371, r = x => x * Math.PI / 180;
  const dLa = r(bLat - aLat), dLo = r(bLng - aLng);
  const s = Math.sin(dLa / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export const kmTexto = d => d == null ? null : d < 1 ? `${Math.round(d * 1000)} m` : `${d.toLocaleString('pt-BR', { maximumFractionDigits: d < 10 ? 1 : 0 })} km`;

export function textoPreco(p) {
  if (p.precoVisita > 0) return `visita ${reais(p.precoVisita)}`;
  if (p.precoHora > 0) return `${reais(p.precoHora)}/h`;
  return null;
}

/** Botão de coração ligado ao estado global de favoritos. */
export function botaoFavorito(D, p, cls = 'fav') {
  const b = h('button', { class: cls, type: 'button' }, icone('coracao'));
  const pintar = () => {
    const on = D.estado.favoritos.has(p.id);
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Tirar dos favoritos' : 'Salvar nos favoritos');
  };
  pintar();
  b.addEventListener('click', async e => {
    e.stopPropagation(); e.preventDefault();
    if (D.estado.visitante) { toast('Crie sua conta para salvar favoritos.'); return; }
    const marcar = !D.estado.favoritos.has(p.id);
    try { await D.favoritar(p.id, marcar); pintar(); if (marcar) toast('Salvo nos favoritos', 'ok'); }
    catch (x) { toast(D.mensagemDeErro(x), 'erro'); pintar(); }
  });
  return b;
}

/**
 * O cartão da lista: quatro linhas com hierarquia (quem é / o que faz e onde / a nota / o resto),
 * sem pílula colorida. A única cor da última linha é a taxa de resposta.
 */
export function cartaoPrestador(D, p, { distancia = null, ir } = {}) {
  const cat = categoriaSinc(p.categoriaId);
  const tr = taxaResposta(p);
  const tp = taxaPreco(p);
  const linhaOnde = [cat.nome, p.bairro || p.cidade, kmTexto(distancia)].filter(Boolean).join(' · ');
  const resto = [
    tr != null ? h('span.resposta', `responde ${tr}%`) : null,
    tp != null ? `preço combinado ${tp}%` : null,
    textoPreco(p),
    p.anosExperiencia ? `${p.anosExperiencia} anos de experiência` : null,
  ].filter(Boolean);

  const a = h('a.cartao.prest', { href: `#/p/${p.id}`, 'aria-label': `${p.nome}, ${cat.nome}` },
    avatar(p.nome, p.fotoUrl, '', atendeAgora(p), p.id),
    h('div.corpo',
      h('div.nome', h('span', p.nome), p.verificado ? h('span.verif', { title: 'Documento verificado' }, icone('verif', 'pp')) : null,
        p.urgencia24h ? h('span.selo-urg', { title: 'Atende urgência 24 h' }, icone('raio', 'pp'), '24h') : null),
      h('div.oque', linhaOnde),
      h('div.nota',
        p.totalAvaliacoes > 0
          ? [h('span.estrela', '★'), h('b', nota1(p.notaMedia || 0)), h('span', { style: { color: 'var(--texto-3)' } }, `(${p.totalAvaliacoes} avaliaç${p.totalAvaliacoes === 1 ? 'ão' : 'ões'})`)]
          : h('span', { style: { color: 'var(--texto-3)' } }, 'Novo no Trampo')),
      resto.length ? h('div.disc', resto.map((r, i) => i ? h('span.ponto-sep', r) : h('span', r))) : null,
      ausente(p) ? h('div.disc', { style: { color: 'var(--alerta)' } }, 'Ausente por um tempo') : null),
    botaoFavorito(D, p));
  return a;
}

export function estrelas(n) {
  const c = Math.round(n);
  return '★★★★★'.slice(0, c) + '☆☆☆☆☆'.slice(0, 5 - c);
}
