// Ponte entre as telas e o motor de busca por frase (js/busca, porte fiel do Kotlin).
// O vocabulário (4,8 MB, ~1 MB comprimido) baixa em segundo plano; até ficar pronto,
// a busca funciona pelo texto puro.
import { Vocabulario, interpretar as interpretarKt, melhorAlternativa as melhorKt, etiquetas as etiquetasKt, filtroDe, aplicar as aplicarKt, ordenar as ordenarKt, Ordem, Campo, ENCHIMENTO, norm } from './busca/index.js';
import { atendeAgora } from './componentes.js';

let vocab = null;
let carregando = null;

export function preparar() {
  if (vocab) return Promise.resolve(vocab);
  return carregando ||= fetch(new URL('../data/vocabulario.txt', import.meta.url))
    .then(r => { if (!r.ok) throw new Error('vocabulário ' + r.status); return r.text(); })
    .then(t => {
      vocab = Vocabulario.carregar(t);
      // Os índices secundários custam ~0,4 s uma vez só: monta quando o navegador estiver folgado,
      // para a primeira frase digitada já responder na hora.
      (window.requestIdleCallback || (f => setTimeout(f, 200)))(() => vocab.preparar?.());
      return vocab;
    })
    .catch(e => { carregando = null; throw e; });
}
export const pronto = () => !!vocab;

/**
 * O motor é idêntico ao Kotlin; as correções ficam aqui, na ponte. O jeito de pedir
 * ("preciso", "quero", "procuro"...) sobrava como texto livre e virava filtro por nome/descrição,
 * zerando a lista de "preciso de diarista". O app Android tem o mesmo defeito.
 */
export function interpretar(frase) {
  const i = interpretarKt(frase, vocab);
  if (!i.textoLivre) return i;
  // Com o serviço reconhecido, a sobra ("água", "sábado"...) só atrapalharia: filtrava nome e
  // descrição e zerava a lista. Ela só vale como busca quando nenhum serviço foi entendido.
  const sobra = i.categoriaId != null ? '' : i.textoLivre.split(/\s+/).filter(w => w && !ENCHIMENTO.has(norm(w))).join(' ');
  if (sobra === i.textoLivre) return i;
  const etiquetas = i.etiquetas.filter(e => e.campo !== Campo.TEXTO);
  if (sobra) etiquetas.push({ campo: Campo.TEXTO, emoji: '', rotulo: `"${sobra}"` });
  return i.copiar({ textoLivre: sobra, etiquetas });
}
export const melhorAlternativa = alts => melhorKt(alts, vocab);
export const etiquetas = i => i ? etiquetasKt(i) : [];
export const sem = (i, campo) => i.sem(campo);
export const temCategoria = i => i?.categoriaId != null;
export const categoriaDe = i => i?.categoriaId;
export const candidatas = i => i && i.categoriaId == null && i.candidatas.length > 1 ? i.candidatas.map(id => ({ id })) : [];
export const termoAmbiguo = i => i?.frase?.trim();
export function escolherCategoria(i, id) {
  const c = vocab?.categoria(id);
  const etiquetas = [{ campo: Campo.CATEGORIA, rotulo: c ? `${c.emoji} ${c.nome}` : 'Categoria', emoji: c?.emoji || '' },
    ...i.etiquetas.filter(e => e.campo !== Campo.CATEGORIA)];
  return i.copiar({ categoriaId: id, candidatas: [], palpite: false, etiquetas });
}

/**
 * Busca pela intenção (ou pelo texto puro, enquanto o vocabulário não chega).
 * A cidade padrão é a da pessoa, como no app; se ninguém de lá atende, mostra de outras
 * cidades em vez de uma tela vazia — e avisa.
 */
export function aplicar(todos, intencao, frase, { usuario, geo }) {
  const lat = geo?.lat ?? null, lng = geo?.lng ?? null;
  let f;
  if (intencao) {
    f = filtroDe(intencao, usuario.cidade || '', lat, lng);
    // Frase que não virou nada: busca pelo texto inteiro (nome, descrição, bairro).
    if (!intencao.entendeu && !f.texto) f.texto = frase.trim();
  } else {
    f = { texto: frase.trim(), cidade: usuario.cidade || '', lat, lng };
  }
  let r = aplicarKt(todos, f);
  // Ninguém no bairro pedido: mostra o mesmo serviço nos outros bairros, mais perto primeiro.
  if (!r.length && f.bairro) {
    const bairro = f.bairro;
    r = aplicarKt(todos, { ...f, bairro: '' });
    r.foraDoBairro = bairro;
  }
  if (!r.length && f.cidade && !(intencao?.cidade)) {
    r = aplicarKt(todos, { ...f, cidade: '' });
    r.foraDaCidade = true;
  }
  return r;
}

export function porCategoria(todos, categoriaId, { usuario, geo }) {
  const f = { categoriaId, cidade: usuario.cidade || '', lat: geo?.lat ?? null, lng: geo?.lng ?? null };
  let r = aplicarKt(todos, f);
  if (!r.length && f.cidade) { r = aplicarKt(todos, { ...f, cidade: '' }); r.foraDaCidade = true; }
  return r;
}

/** Os filtros rápidos da tela de resultados (chips). */
export function filtrarExtras(res, filtros) {
  if (!filtros.size) return res;
  const saida = res.filter(({ prestador: p }) =>
    (!filtros.has('agora') || atendeAgora(p)) &&
    (!filtros.has('24h') || p.urgencia24h) &&
    (!filtros.has('verificado') || p.verificado) &&
    (!filtros.has('preco') || p.precoVisita > 0 || p.precoHora > 0) &&
    (!filtros.has('pet') || p.petFriendly));
  saida.foraDaCidade = res.foraDaCidade; saida.foraDoBairro = res.foraDoBairro;
  return saida;
}

const ORDEM_DA_TELA = { relevancia: Ordem.RELEVANCIA, nota: Ordem.AVALIACAO, perto: Ordem.DISTANCIA, resposta: Ordem.RESPOSTA };
export function ordenar(res, ordem) {
  if (ordem === 'relevancia') return res; // já vem na ordem do motor (ou na que a frase pediu)
  const r = ordenarKt(res, ORDEM_DA_TELA[ordem] || Ordem.RELEVANCIA);
  r.foraDaCidade = res.foraDaCidade; r.foraDoBairro = res.foraDoBairro;
  return r;
}

/** "Bem avaliados" da vitrine: os mais indicados da cidade da pessoa (ou de todas). */
export function destaques(todos, usuario, n) {
  let r = aplicarKt(todos, { cidade: usuario.cidade || '', lat: usuario.lat ?? null, lng: usuario.lng ?? null, notaMinima: 4 });
  if (r.length < n) r = aplicarKt(todos, { notaMinima: 4 });
  // Entre os 30 mais indicados, quem tem fotos de trabalho aparece primeiro na vitrine.
  const temFoto = x => ((x.prestador.fotos || []).length + (x.prestador.antesDepois || []).length) > 0 ? 1 : 0;
  return r.slice(0, 30).map((x, i) => [x, i]).sort((a, b) => temFoto(b[0]) - temFoto(a[0]) || a[1] - b[1]).slice(0, n).map(a => a[0]);
}
