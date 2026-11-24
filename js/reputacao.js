// Porte fiel de data/Reputacao.kt e data/Antifraude.kt (app Android Trampo2).
//
// JavaScript puro, ES module, sem dependencias: roda no navegador e no Node 18+.
// Os objetos usam os nomes de campo do Firestore (os mesmos das data classes de
// Modelos.kt); campo ausente vale o mesmo padrao que o Kotlin daria.
//
// Equivalencia provada por web/tests/reputacao.test.mjs contra a referencia
// gerada pelo proprio Kotlin (app/src/test/.../ExportarReputacaoWebTest.kt).

import { norm, contem } from './busca/texto.js';

// ===================================================================== Reputacao

/** Nota media da plataforma inteira. Para onde a nota de novato e puxada. */
export const MEDIA_GERAL = 4.3;
/** Peso da media geral. Equivale a "comeca com 5 avaliacoes na media". */
export const PESO_INICIAL = 5.0;
/** Depois de 180 dias, uma avaliacao vale metade. */
export const MEIA_VIDA_DIAS = 180.0;

const DIA_MS = 24 * 60 * 60 * 1000.0;
const LN2 = Math.log(2.0);

const num = (v, padrao = 0) => (typeof v === 'number' && !Number.isNaN(v) ? v : padrao);
const notaDe = (a) => num(a && a.nota, 5); // Avaliacao.nota tem padrao 5 no Kotlin
const criadoDe = (o) => num(o && o.criadoEm, 0);

/** Peso de uma avaliacao pela idade (meia-vida de 180 dias; futuro conta como agora). */
export function pesoPorIdade(avaliacaoEm, agora) {
  const dias = Math.max(0.0, (agora - avaliacaoEm) / DIA_MS);
  return Math.exp(-LN2 * dias / MEIA_VIDA_DIAS);
}

/**
 * A nota que aparece na lista: media bayesiana (puxada para 4,3 com peso 5)
 * com meia-vida. Lista vazia = 0. Resultado entre 1 e 5.
 */
export function nota(avaliacoes, agora = Date.now()) {
  if (!avaliacoes || avaliacoes.length === 0) return 0.0;
  let soma = PESO_INICIAL * MEDIA_GERAL;
  let peso = PESO_INICIAL;
  for (const a of avaliacoes) {
    const p = pesoPorIdade(criadoDe(a), agora);
    soma += notaDe(a) * p;
    peso += p;
  }
  return Math.min(5.0, Math.max(1.0, soma / peso));
}

/** Quantas notas 1, 2, 3, 4 e 5, nessa ordem (nota fora de 1..5 e ignorada). */
export function distribuicao(avaliacoes) {
  const d = [0, 0, 0, 0, 0];
  for (const a of avaliacoes || []) {
    const n = notaDe(a);
    if (Number.isInteger(n) && n >= 1 && n <= 5) d[n - 1]++;
  }
  return d;
}

/** O elogio pronto, como pares [emoji, frase] (igual a Reputacao.ELOGIOS). */
export const ELOGIOS = Object.freeze([
  ['⏰', 'Chegou na hora'],
  ['🏅', 'Trabalho caprichado'],
  ['💰', 'Preço justo'],
  ['🧹', 'Deixou tudo limpo'],
  ['🤝', 'Foi atencioso'],
  ['⚡', 'Resolveu rápido'],
  ['📅', 'Entregou no prazo'],
  ['👍', 'Recomendo']
].map((p) => Object.freeze(p)));

/** [nome, emoji, termos] — a mesma tabela privada SELOS do Kotlin. */
const SELOS = [
  ['Bom atendimento', '🤝', [
    'bom atendimento', 'atencioso', 'atenciosa', 'educado', 'educada',
    'simpatico', 'simpatica', 'gente boa', 'paciente', 'prestativo',
    'prestativa', 'otimo atendimento', 'otima pessoa', 'respeitoso',
    'tratou bem', 'super atencioso', 'muito atencioso'
  ]],
  ['Chega na hora', '⏰', [
    'pontual', 'chegou na hora', 'no horario', 'nao atrasou', 'chegou cedo',
    'cumpriu o horario', 'pontualidade', 'chegou pontualmente', 'hora marcada'
  ]],
  ['Entrega no prazo', '📅', [
    'no prazo', 'entregou no prazo', 'dentro do prazo', 'prazo combinado',
    'terminou no dia', 'cumpriu o prazo', 'adiantou o servico'
  ]],
  ['Trabalho caprichado', '🏅', [
    'caprichado', 'caprichoso', 'bem feito', 'excelente trabalho',
    'otimo trabalho', 'trabalho impecavel', 'acabamento otimo',
    'ficou perfeito', 'ficou otimo', 'servico de qualidade', 'profissional'
  ]],
  ['Preço justo', '💰', [
    'preco justo', 'preco bom', 'cobrou justo', 'nao cobrou caro',
    'valor justo', 'otimo custo beneficio', 'em conta', 'barato',
    'nao abusou no preco', 'orcamento honesto'
  ]],
  ['Limpou tudo', '🧹', [
    'deixou tudo limpo', 'limpou tudo', 'nao deixou sujeira',
    'organizado', 'deixou limpo', 'cuidadoso com a casa'
  ]],
  ['Resolveu rápido', '⚡', [
    'rapido', 'resolveu rapido', 'veio na hora', 'atendeu na hora',
    'agil', 'resolveu no mesmo dia', 'urgencia atendida', 'veio correndo'
  ]],
  ['Recomendo', '👍', [
    'recomendo', 'super recomendo', 'recomendadissimo', 'indico',
    'voltaria a contratar', 'chamaria de novo', 'ja e o meu profissional'
  ]]
];

/** Nomes dos selos, na ordem da tabela. */
export const NOMES_SELOS = Object.freeze(SELOS.map((s) => s[0]));

let SELOS_NORM = null; // normalizado uma vez, na primeira chamada (como o `by lazy`)

/**
 * O que se repete nos comentarios vira selo: { nome: vezes }, do mais citado
 * para o menos (empate mantem a ordem em que apareceu, como no Kotlin).
 * Cada avaliacao conta no maximo 1 por selo.
 */
export function selos(avaliacoes) {
  if (!SELOS_NORM) SELOS_NORM = SELOS.map(([nome, , termos]) => [nome, termos.map(norm)]);
  const contagem = new Map();
  for (const a of avaliacoes || []) {
    const c = a && typeof a.comentario === 'string' ? a.comentario : '';
    if (c.trim() === '') continue;
    const n = norm(c);
    for (const [nome, termos] of SELOS_NORM) {
      if (termos.some((t) => contem(n, t))) contagem.set(nome, (contagem.get(nome) || 0) + 1);
    }
  }
  const ordenado = [...contagem.entries()].sort((x, y) => y[1] - x[1]); // sort e estavel
  const saida = {};
  for (const [k, v] of ordenado) saida[k] = v;
  return saida;
}

/** Emoji do selo pelo nome exato; desconhecido = "🏷". */
export function emojiDoSelo(nome) {
  const s = SELOS.find((x) => x[0] === nome);
  return s ? s[1] : '🏷';
}

// ------------------------------------------------- campos derivados de Prestador

const int = (v) => Math.trunc(num(v, 0));
const taxa = (num_, den) => Math.min(100, Math.max(0, Math.trunc((int(num_) * 100) / int(den))));

/** Prestador.taxaResposta: % respondidos, so com 5+ contatos recebidos; senao null. */
export function taxaResposta(p) {
  return int(p.contatosRecebidos) >= 5 ? taxa(p.contatosRespondidos, p.contatosRecebidos) : null;
}
/** Prestador.taxaPrecoCumprido: so com 3+ precos avaliados; senao null. */
export function taxaPrecoCumprido(p) {
  return int(p.precosAvaliados) >= 3 ? taxa(p.precoCumprido, p.precosAvaliados) : null;
}
/** Prestador.taxaComparecimento: so com 3+ combinados; senao null. */
export function taxaComparecimento(p) {
  return int(p.combinados) >= 3 ? taxa(p.compareceu, p.combinados) : null;
}
/** Prestador.taxaRapidez: so com 5+ respostas avaliadas; senao null. */
export function taxaRapidez(p) {
  return int(p.respostasAvaliadas) >= 5 ? taxa(p.respondeuRapido, p.respostasAvaliadas) : null;
}
/** Prestador.atendeAgora: disponivel (padrao true) e ativo ha menos de 15 min. */
export function atendeAgora(p, agora) {
  const disponivel = p.disponivel !== false;
  return disponivel && agora - num(p.ultimaAtividade, 0) < 15 * 60000;
}
/** Prestador.temPreco. */
export function temPreco(p) {
  return num(p.precoVisita, 0) > 0 || num(p.precoHora, 0) > 0;
}

/**
 * A pontuacao que decide a ordem da lista de resultados.
 * `distanciaKm` pode ser null/undefined (sem localizacao).
 */
export function pontuacao(p, distanciaKm, agora) {
  let s = num(p.notaMedia, 0) * 10.0;
  s += Math.min(int(p.totalAvaliacoes), 50) * 0.2;
  s += Math.min(int(p.compareceu), 200) * 0.05;
  const tr = taxaResposta(p);
  if (tr != null) s += tr * 0.12;
  if (p.verificado === true) s += 6.0;
  if (atendeAgora(p, agora)) s += 4.0;
  if (temPreco(p)) s += 2.0;
  if (distanciaKm != null) s += Math.max(0.0, 12.0 - distanciaKm);
  return s;
}

// ==================================================================== Antifraude

/** Tempo minimo entre chamar o profissional e poder avaliar. */
export const ESPERA_MS = 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;
const DIA_AF = 24 * HORA_MS;

/**
 * Analisa uma avaliacao no contexto das outras do mesmo prestador.
 * Devolve { motivo } quando ha algo estranho, ou null quando esta tudo bem.
 * Nunca apaga nada: quem chama grava suspeita=true e motivoSuspeita=motivo.
 *
 * @param nova                 Avaliacao sendo gravada
 * @param autor                Usuario que avalia (pode ser null)
 * @param anteriores           Avaliacoes ja existentes do mesmo prestador
 * @param contasMesmoAparelho  quantas contas usam o mesmo `aparelho` (padrao 0)
 */
export function analisar(nova, autor, anteriores, contasMesmoAparelho = 0) {
  const criado = criadoDe(nova);
  const lista = anteriores || [];

  // Conta recem-criada dando nota maxima: o padrao classico do autoelogio.
  if (autor != null && criadoDe(autor) > 0 &&
      criado - criadoDe(autor) < DIA_AF && notaDe(nova) >= 5) {
    return { motivo: 'Conta criada no mesmo dia da avaliação nota 5' };
  }

  // Rajada: cinco notas em tres horas nao e movimento normal de agenda.
  let janela = 0;
  for (const a of lista) if (Math.abs(criadoDe(a) - criado) < 3 * HORA_MS) janela++;
  if (janela >= 5) return { motivo: `${janela} avaliações em menos de 3 horas` };

  // Varias contas saindo do mesmo celular.
  const contas = num(contasMesmoAparelho, 0);
  if (contas >= 3) return { motivo: `${contas} contas no mesmo aparelho` };

  // A mesma pessoa avaliando de novo.
  const cid = (nova && nova.clienteId) ?? '';
  let doMesmoAutor = 0;
  for (const a of lista) if (((a && a.clienteId) ?? '') === cid) doMesmoAutor++;
  if (doMesmoAutor > 1) return { motivo: 'Mesmo cliente avaliou mais de uma vez' };

  return null;
}

/** Quanto falta (ms) para o botao de avaliar liberar. Zero = ja pode. */
export function faltaParaAvaliar(contato, agora) {
  return Math.max(0, criadoDe(contato) + ESPERA_MS - agora);
}

/** So avalia quem chamou, ainda nao avaliou e esperou uma hora. */
export function podeAvaliar(contato, agora) {
  return contato != null && contato.avaliado !== true && faltaParaAvaliar(contato, agora) === 0;
}

// ============================================ contadores das confirmacoes do contato
//
// Espelham RepositorioFirebase.confirmarResposta / confirmarComparecimento /
// confirmarPreco quando a reputacao NAO esta no servidor: o que gravar no contato
// e quanto somar em cada campo do prestador (cada campo sobe exatamente 1, e o
// app manda um `update` por campo, porque a regra do Firestore so aceita +1).

/** confirmarResposta(respondeu, rapido). */
export function efeitoResposta(respondeu, rapido) {
  return {
    contato: { respondeu: !!respondeu, respondeuRapido: !!respondeu && !!rapido },
    incrementos: !respondeu ? {} : Object.assign(
      { contatosRespondidos: 1, respostasAvaliadas: 1 },
      rapido ? { respondeuRapido: 1 } : {}
    )
  };
}

/** confirmarComparecimento(compareceu): combinado conta sempre. */
export function efeitoComparecimento(compareceu) {
  return {
    contato: { compareceu: !!compareceu },
    incrementos: Object.assign({ combinados: 1 }, compareceu ? { compareceu: 1 } : {})
  };
}

/** confirmarPreco(cumpriu): o denominador sobe sempre. */
export function efeitoPreco(cumpriu) {
  return {
    contato: { precoCumpriu: !!cumpriu },
    incrementos: Object.assign({ precosAvaliados: 1 }, cumpriu ? { precoCumprido: 1 } : {})
  };
}

/**
 * Os campos que avaliar() grava no prestador (quando a reputacao nao esta no
 * servidor), a partir da lista inteira ja com a nova avaliacao.
 */
export function camposDoPrestador(todas, agora = Date.now()) {
  return {
    notaMedia: nota(todas, agora),
    totalAvaliacoes: todas.length,
    distribuicao: distribuicao(todas),
    selos: selos(todas)
  };
}

export const Reputacao = {
  MEDIA_GERAL, PESO_INICIAL, MEIA_VIDA_DIAS, ELOGIOS, NOMES_SELOS,
  pesoPorIdade, nota, distribuicao, selos, emojiDoSelo, pontuacao,
  taxaResposta, taxaPrecoCumprido, taxaComparecimento, taxaRapidez, atendeAgora, temPreco,
  camposDoPrestador
};
export const Antifraude = { ESPERA_MS, analisar, faltaParaAvaliar, podeAvaliar };
export default { ...Reputacao, ...Antifraude, efeitoResposta, efeitoComparecimento, efeitoPreco };
