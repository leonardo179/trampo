// Porte de entrada/IntencaoBusca.kt + entrada/Ambiguidade.kt.
//
// O que o app extraiu da frase. Tudo e opcional de proposito: uma busca que so
// entendeu "encanador" e uma busca boa. Cada coisa entendida vira uma etiqueta
// com "x", e tirar a etiqueta precisa saber exatamente qual filtro apagar.

/** Como a lista de resultados vai ser ordenada (enum Ordem do Kotlin). */
export const Ordem = Object.freeze({
  RELEVANCIA: 'RELEVANCIA',
  AVALIACAO: 'AVALIACAO',
  SERVICOS: 'SERVICOS',
  DISTANCIA: 'DISTANCIA',
  RESPOSTA: 'RESPOSTA',
  PRECO: 'PRECO'
});

export const ROTULO_ORDEM = Object.freeze({
  RELEVANCIA: 'Mais relevantes',
  AVALIACAO: 'Melhor avaliados',
  SERVICOS: 'Mais serviços feitos',
  DISTANCIA: 'Mais próximos',
  RESPOSTA: 'Respondem mais rápido',
  PRECO: 'Menor preço'
});

export const EMOJI_ORDEM = Object.freeze({
  AVALIACAO: '⭐',
  SERVICOS: '🧰',
  DISTANCIA: '📍',
  RESPOSTA: '⏱',
  PRECO: '💰',
  RELEVANCIA: '🔎'
});

/** O campo de cada etiqueta (enum Campo do Kotlin). */
export const Campo = Object.freeze({
  CATEGORIA: 'CATEGORIA',
  URGENCIA: 'URGENCIA',
  RAIO: 'RAIO',
  ORDEM: 'ORDEM',
  BAIRRO: 'BAIRRO',
  CIDADE: 'CIDADE',
  PET: 'PET',
  MULHER: 'MULHER',
  PRECO: 'PRECO',
  VERIFICADO: 'VERIFICADO',
  AGORA: 'AGORA',
  TEXTO: 'TEXTO'
});

const PADRAO = Object.freeze({
  frase: '',
  categoriaId: null,
  candidatas: [],
  palpite: false,
  pontos: null,
  urgente: false,
  raioKm: null,
  ordem: Ordem.RELEVANCIA,
  bairro: null,
  cidade: null,
  petFriendly: false,
  soMulheres: false,
  soVerificados: false,
  soDisponiveis: false,
  precoMax: null,
  querOrcamento: false,
  textoLivre: '',
  leituraExata: false,
  tituloSugerido: '',
  etiquetas: []
});

/**
 * O resultado de `interpretar`. Os campos tem os mesmos nomes do data class
 * Kotlin. `pontos` e um Map<idCategoria, pontos> (so para testes/diagnostico).
 */
export class IntencaoBusca {
  constructor(dados = {}) {
    for (const k of Object.keys(PADRAO)) {
      this[k] = dados[k] !== undefined ? dados[k] : PADRAO[k];
    }
    if (this.pontos == null) this.pontos = new Map();
  }

  /** O app conseguiu tirar alguma coisa da frase, ou vai buscar pelo texto puro? */
  get entendeu() {
    return this.categoriaId != null || this.candidatas.length > 0 || this.etiquetas.length > 0;
  }

  /** Mais de uma leitura possivel e nenhuma escolhida: a folha de escolha pergunta. */
  get precisaPerguntar() {
    return this.categoriaId == null && this.candidatas.length > 1;
  }

  copiar(mudancas) {
    const base = {};
    for (const k of Object.keys(PADRAO)) base[k] = this[k];
    return new IntencaoBusca(Object.assign(base, mudancas));
  }

  /** Tira um filtro sozinho, sem obrigar a pessoa a reescrever a frase. */
  sem(campo) {
    const etiquetas = this.etiquetas.filter(e => e.campo !== campo);
    switch (campo) {
      case Campo.CATEGORIA: return this.copiar({ categoriaId: null, candidatas: [], etiquetas });
      case Campo.URGENCIA: return this.copiar({ urgente: false, etiquetas });
      case Campo.RAIO: return this.copiar({ raioKm: null, etiquetas });
      case Campo.ORDEM: return this.copiar({ ordem: Ordem.RELEVANCIA, etiquetas });
      case Campo.BAIRRO: return this.copiar({ bairro: null, etiquetas });
      case Campo.CIDADE: return this.copiar({ cidade: null, etiquetas });
      case Campo.PET: return this.copiar({ petFriendly: false, etiquetas });
      case Campo.MULHER: return this.copiar({ soMulheres: false, etiquetas });
      case Campo.PRECO: return this.copiar({ precoMax: null, querOrcamento: false, etiquetas });
      case Campo.VERIFICADO: return this.copiar({ soVerificados: false, etiquetas });
      case Campo.AGORA: return this.copiar({ soDisponiveis: false, etiquetas });
      case Campo.TEXTO: return this.copiar({ textoLivre: '', etiquetas });
      default: return this.copiar({ etiquetas });
    }
  }

  limpa() {
    return new IntencaoBusca({ frase: '' });
  }
}

/** Versao funcional de `intencao.sem(campo)`. */
export function sem(intencao, campo) {
  return intencao.sem(campo);
}

/** As etiquetas para a tela: [{campo, rotulo, emoji}], na ordem do Kotlin. */
export function etiquetas(intencao) {
  return intencao.etiquetas.map(e => ({ campo: e.campo, rotulo: e.rotulo, emoji: e.emoji }));
}

/**
 * Porte de PerguntaBusca.de (Ambiguidade.kt): a folha de escolha, ou null
 * quando nao ha duvida. Ambiguidade nunca chuta: volta as opcoes.
 * @returns {{frase:string, pergunta:string, opcoes:Array<{categoriaId:number,emoji:string,titulo:string,detalhe:string}>}|null}
 */
export function pergunta(intencao, vocab) {
  if (!intencao.precisaPerguntar || !vocab) return null;
  const opcoes = [];
  for (const id of intencao.candidatas) {
    const c = vocab.categoria(id);
    if (c) opcoes.push({ categoriaId: id, emoji: c.emoji, titulo: c.nome, detalhe: c.grupo });
  }
  if (opcoes.length < 2) return null;
  const texto = intencao.palpite ? 'Não tenho certeza. É algum destes?' : 'Qual desses você procura?';
  return { frase: intencao.frase, pergunta: texto, opcoes };
}
