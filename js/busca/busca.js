// Porte de data/Busca.kt (+ Localizacao.entre, Reputacao.pontuacao, Filtro.de
// e os campos calculados de Prestador/Pedido usados pela busca).
//
// O Firestore entrega o conjunto grosso (disponivel + cidade + categoria, ate
// 300 documentos, como RepositorioFirebase.buscar) e o refino acontece aqui:
// distancia, nota ponderada, taxa de resposta, teto de preco. Os objetos de
// entrada sao os documentos do Firestore como vierem (mesmos nomes de campo do
// data class Prestador); campo ausente vale o padrao do Kotlin.

import { norm } from './texto.js';
import { Ordem } from './intencao.js';

const QUINZE_MIN = 15 * 60000;
const DIA = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------ campos do Prestador

const num = (v, padrao = 0) => (typeof v === 'number' && !Number.isNaN(v) ? v : padrao);
const str = v => (v == null ? '' : String(v));
const bool = (v, padrao = false) => (v == null ? padrao : !!v);
const coordenada = v => (typeof v === 'number' && !Number.isNaN(v) ? v : null);

/** Prestador.disponivel tem padrao true no Kotlin. */
const disponivel = p => bool(p.disponivel, true);

/** Prestador.atendeAgora(agora). */
export function atendeAgora(p, agora = Date.now()) {
  return disponivel(p) && agora - num(p.ultimaAtividade) < QUINZE_MIN;
}

/** Prestador.taxaResposta: so com 5 contatos ou mais; 0..100 ou null. */
export function taxaResposta(p) {
  const rec = num(p.contatosRecebidos);
  if (rec < 5) return null;
  return Math.min(100, Math.max(0, Math.trunc(num(p.contatosRespondidos) * 100 / rec)));
}

/** Prestador.taxaRapidez: so com 5 opinioes ou mais; 0..100 ou null. */
export function taxaRapidez(p) {
  const av = num(p.respostasAvaliadas);
  if (av < 5) return null;
  return Math.min(100, Math.max(0, Math.trunc(num(p.respondeuRapido) * 100 / av)));
}

export function temPreco(p) {
  return num(p.precoVisita) > 0 || num(p.precoHora) > 0;
}

// ------------------------------------------------------------ Localizacao

const RAIO_TERRA_KM = 6371.0;
const rad = g => g * Math.PI / 180;

export function distanciaKm(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1.0, Math.sqrt(a)));
}

/** Localizacao.entre: distancia do prestador ao ponto, ou null se faltar coordenada. */
export function distanciaAte(p, lat, lng) {
  const plat = coordenada(p.lat);
  const plng = coordenada(p.lng);
  if (lat == null || lng == null || plat == null || plng == null) return null;
  return distanciaKm(lat, lng, plat, plng);
}

// ------------------------------------------------------------ Reputacao

/** Reputacao.pontuacao: a nota da ordem "Mais relevantes". */
export function pontuacao(p, distancia, agora = Date.now()) {
  let s = num(p.notaMedia) * 10.0;
  s += Math.min(num(p.totalAvaliacoes), 50) * 0.2;
  s += Math.min(num(p.compareceu), 200) * 0.05;
  const tr = taxaResposta(p);
  if (tr != null) s += tr * 0.12;
  if (bool(p.verificado)) s += 6.0;
  if (atendeAgora(p, agora)) s += 4.0;
  if (temPreco(p)) s += 2.0;
  if (distancia != null) s += Math.max(0.0, 12.0 - distancia);
  return s;
}

// ------------------------------------------------------------ Filtro

/**
 * O filtro da busca (data class Filtro do Kotlin), com os padroes.
 * @returns {{categoriaId:number|null,texto:string,cidade:string,bairro:string,lat:number|null,lng:number|null,raioKm:number|null,ordem:string,urgencia24h:boolean,petFriendly:boolean,soMulheres:boolean,soVerificados:boolean,soDisponiveis:boolean,precoMax:number|null,notaMinima:number}}
 */
export function filtro(campos = {}) {
  return Object.assign({
    categoriaId: null, texto: '', cidade: '', bairro: '', lat: null, lng: null,
    raioKm: null, ordem: Ordem.RELEVANCIA, urgencia24h: false, petFriendly: false,
    soMulheres: false, soVerificados: false, soDisponiveis: false, precoMax: null,
    notaMinima: 0.0
  }, campos);
}

/** Filtro.de(intencao, cidade, lat, lng): a ponte entre a frase interpretada e a consulta. */
export function filtroDe(i, cidade = '', lat = null, lng = null) {
  return filtro({
    categoriaId: i.categoriaId,
    texto: i.textoLivre,
    cidade: i.cidade && i.cidade.trim() !== '' ? i.cidade : cidade,
    bairro: i.bairro || '',
    lat, lng,
    raioKm: i.raioKm,
    ordem: i.ordem,
    urgencia24h: i.urgente,
    petFriendly: i.petFriendly,
    soMulheres: i.soMulheres,
    soVerificados: i.soVerificados,
    soDisponiveis: i.soDisponiveis,
    precoMax: i.precoMax
  });
}

// ------------------------------------------------------------ aplicar

const desc = f => (a, b) => { const x = f(a), y = f(b); return x > y ? -1 : x < y ? 1 : 0; };
const asc = f => (a, b) => { const x = f(a), y = f(b); return x < y ? -1 : x > y ? 1 : 0; };
const entao = (...cmps) => (a, b) => { for (const c of cmps) { const r = c(a, b); if (r) return r; } return 0; };

/**
 * Busca.aplicar: filtra e ordena prestadores (documentos do Firestore).
 * @param {object[]} base prestadores
 * @param {object} f filtro (ver `filtro()` / `filtroDe()`)
 * @param {number} [agora] epoch ms
 * @returns {Array<{prestador:object, distanciaKm:number|null, pontuacao:number}>}
 */
export function aplicar(base, f, agora = Date.now()) {
  f = filtro(f);
  const texto = norm(f.texto);
  const bairro = norm(f.bairro);
  const cidade = norm(f.cidade);

  const filtrados = [];
  for (const p of base || []) {
    if (!disponivel(p)) continue;
    if (f.categoriaId != null && num(p.categoriaId) !== f.categoriaId &&
        !(Array.isArray(p.categoriasExtras) && p.categoriasExtras.includes(f.categoriaId))) continue;
    if (cidade !== '' && norm(str(p.cidade)) !== cidade) continue;
    if (bairro !== '' && !norm(str(p.bairro)).includes(bairro)) continue;
    if (f.urgencia24h && !bool(p.urgencia24h)) continue;
    if (f.petFriendly && !bool(p.petFriendly)) continue;
    if (f.soMulheres && str(p.genero).toUpperCase() !== 'F') continue;
    if (f.soVerificados && !bool(p.verificado)) continue;
    if (f.soDisponiveis && !atendeAgora(p, agora)) continue;
    if (f.notaMinima > 0.0 && num(p.notaMedia) < f.notaMinima) continue;
    if (f.precoMax != null) {
      // So contam os precos declarados (> 0); quem nao declarou continua aparecendo.
      const declarados = [num(p.precoVisita), num(p.precoHora)].filter(v => v > 0.0);
      if (declarados.length > 0 && !declarados.some(v => v <= f.precoMax)) continue;
    }
    if (texto !== '' &&
        !norm(str(p.nome)).includes(texto) &&
        !norm(str(p.descricao)).includes(texto) &&
        !norm(str(p.bairro)).includes(texto)) continue;
    const d = distanciaAte(p, f.lat, f.lng);
    if (f.raioKm != null && d != null && d > f.raioKm) continue;
    filtrados.push({ prestador: p, distanciaKm: d, pontuacao: pontuacao(p, d, agora) });
  }

  return ordenar(filtrados, f.ordem);
}

/** A ordem de Busca.aplicar, separada para quem ja tem os resultados. */
export function ordenar(resultados, ordem = Ordem.RELEVANCIA) {
  const r = resultados.slice();
  const P = x => x.prestador;
  switch (ordem) {
    case Ordem.AVALIACAO:
      return r.sort(entao(desc(x => num(P(x).notaMedia)), desc(x => num(P(x).totalAvaliacoes))));
    case Ordem.SERVICOS:
      return r.sort(desc(x => num(P(x).compareceu)));
    case Ordem.DISTANCIA:
      return r.sort(asc(x => (x.distanciaKm == null ? Number.MAX_VALUE : x.distanciaKm)));
    case Ordem.RESPOSTA:
      return r.sort(entao(
        desc(x => { const t = taxaResposta(P(x)); return t == null ? -1 : t; }),
        desc(x => { const t = taxaRapidez(P(x)); return t == null ? -1 : t; })));
    case Ordem.PRECO:
      return r.sort(asc(x => {
        const p = P(x);
        if (num(p.precoVisita) > 0) return num(p.precoVisita);
        if (num(p.precoHora) > 0) return num(p.precoHora);
        return Number.MAX_VALUE;
      }));
    case Ordem.RELEVANCIA:
    default:
      return r.sort(desc(x => x.pontuacao));
  }
}

// ------------------------------------------------------------ mural

/** Pedido.venceu: urgente vence em 2 dias, o resto em 14. */
export function pedidoVenceu(p, agora = Date.now()) {
  const criado = num(p.criadoEm);
  if (criado <= 0) return false;
  const prazo = bool(p.urgente) ? DIA * 2 : DIA * 14;
  return agora - criado > prazo;
}

/**
 * Busca.aplicarMural: filtra e ordena pedidos do mural.
 * @param {object[]} base pedidos (documentos do Firestore)
 * @param {{categoriaId?:number|null,todasCategorias?:boolean,cidade?:string,raioKm?:number|null,palavra?:string,lat?:number|null,lng?:number|null,soUrgentes?:boolean}} f
 * @param {number} [agora]
 * @param {string|null} [euSou] id de quem esta olhando (os pedidos dele saem)
 */
export function aplicarMural(base, f = {}, agora = Date.now(), euSou = null) {
  const palavra = norm(f.palavra || '');
  const cidade = norm(f.cidade || '');
  const lista = (base || []).filter(p => {
    if (bool(p.encerrado)) return false;
    if (euSou && str(p.clienteId) === euSou) return false;
    if (pedidoVenceu(p, agora)) return false;
    if (!(f.todasCategorias || f.categoriaId == null || num(p.categoriaId) === f.categoriaId)) return false;
    if (cidade !== '' && norm(str(p.cidade)) !== cidade) return false;
    if (f.soUrgentes && !bool(p.urgente)) return false;
    if (palavra !== '' &&
        !norm(str(p.titulo)).includes(palavra) &&
        !norm(str(p.descricao)).includes(palavra) &&
        !norm(str(p.bairro)).includes(palavra)) return false;
    const plat = coordenada(p.lat), plng = coordenada(p.lng);
    if (f.raioKm == null || f.lat == null || f.lng == null || plat == null || plng == null) return true;
    return distanciaKm(f.lat, f.lng, plat, plng) <= f.raioKm;
  });
  return lista.sort(entao(desc(p => (bool(p.urgente) ? 1 : 0)), desc(p => num(p.criadoEm))));
}

/** Busca.distanciaDoPedido. */
export function distanciaDoPedido(p, lat, lng) {
  const plat = coordenada(p.lat), plng = coordenada(p.lng);
  if (lat == null || lng == null || plat == null || plng == null) return null;
  return distanciaKm(lat, lng, plat, plng);
}

/** Busca.idade: "há 2 h", "há 3 dias". */
export function idade(criadoEm, agora = Date.now()) {
  const min = Math.trunc((agora - criadoEm) / 60000);
  const horas = Math.trunc(min / 60);
  const dias = Math.trunc(min / (60 * 24));
  const meses = Math.trunc(min / (60 * 24 * 30));
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return horas === 1 ? 'há 1 h' : `há ${horas} h`;
  if (min < 60 * 24 * 30) return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
  return meses === 1 ? 'há 1 mês' : `há ${meses} meses`;
}

export const Busca = {
  aplicar, ordenar, aplicarMural, distanciaDoPedido, idade, filtro, filtroDe,
  pontuacao, distanciaKm, distanciaAte, atendeAgora, taxaResposta, taxaRapidez, temPreco, pedidoVenceu
};
export default Busca;
