// Porte de entrada/Vocabulario.kt — o dicionario de servicos, ja indexado.
//
// Sao tres indices, cada um existindo por uma frase real que falhava sem ele:
//  - exato      — "instalar chuveiro" casa com "instalar chuveiro";
//  - sem cola   — "trocar o chuveiro" tambem casa (preposicoes fora dos dois lados);
//  - por radical — "pc lentissimo" encontra "computador lento" (ultimo recurso).
//
// Formato do arquivo (gerado por gerar.py):
//   V1
//   C|id|nome|emoji|grupo
//   T|termo|cat:peso,cat:peso
//
// As estruturas derivadas (nucleos, baldes de grafia, palavra-dentro-de-termo)
// sao preguicosas como no Kotlin e montadas na ordem de iteracao do HashMap do
// Java (ver ordemjava.js), para os desempates darem o mesmo resultado do app.

import { VAZIAS, ngramas } from './texto.js';
import * as Radicais from './radicais.js';
import * as Aproximado from './aproximado.js';
import { ordenarComoJava, hashString, hashInt, capacidadeFinal } from './ordemjava.js';

/** Daqui para cima o termo e nome de profissao, nao objeto solto. */
export const PESO_NUCLEO = 8;

/** Palavras que ligam a frase e nao dizem nada sobre o servico. */
export const COLA = new Set([
  'de', 'da', 'do', 'das', 'dos', 'o', 'a', 'os', 'as', 'um', 'uma',
  'no', 'na', 'nos', 'nas', 'em', 'para', 'pra', 'pro', 'com', 'que',
  'ao', 'aos', 'e', 'meu', 'minha', 'meus', 'minhas', 'seu', 'sua',
  'ta', 'esta', 'to', 'tou', 'estou', 'ja', 'so',
  'mas', 'porem', 'tambem'
]);

/** O jeito de pedir, que nao e servico nenhum (so serve ao corte de palavra colada). */
export const ENCHIMENTO = new Set([
  'faz', 'fazer', 'faca', 'quero', 'queria', 'preciso', 'precisa',
  'precisando', 'procuro', 'procurando', 'busco', 'buscando', 'chamar',
  'contratar', 'indica', 'indicar', 'conhece', 'custa', 'quanto',
  'tem', 'alguem', 'algum', 'alguma', 'cade', 'onde', 'acho', 'ajuda',
  'ajudar', 'resolver', 'arrumar', 'orcamento', 'preco', 'urgente',
  'hoje', 'agora', 'favor', 'obrigado', 'bom', 'boa', 'otimo',
  'tenho', 'temos', 'tinha', 'aconteceu', 'acontece', 'deu', 'ficou',
  'esta', 'estou', 'aqui', 'ali', 'la', 'perto', 'regiao', 'bairro',
  'ate', 'por', 'sem', 'mais', 'menos', 'muito', 'pouco', 'mesmo',
  'ainda', 'nao', 'sim', 'bem', 'melhor', 'pior', 'rapido', 'barato',
  'justo', 'conta', 'reais', 'profissional', 'pessoa', 'gente',
  'avaliado', 'avaliada', 'recomendado', 'recomendada', 'confiavel',
  'seja', 'possa', 'pode', 'poderia', 'consegue', 'vem', 'vir',
  'amanha', 'cedo', 'tarde', 'noite', 'manha', 'dia', 'semana'
]);

// A mesma coisa que split(' ').filterNot { it in COLA }.joinToString(" "), mas
// sem criar um array por termo: sao ~100 mil termos compostos na carga.
const RE_COLA = new RegExp('(?:^| )(?:' + [...COLA].join('|') + ')(?= |$)', 'g');

function semCola(termo) {
  const r = termo.replace(RE_COLA, '');
  return r.charCodeAt(0) === 32 ? r.slice(1) : r;
}

/**
 * Duas grafias podem apontar para a mesma categoria: fica o maior peso.
 * A primeira vez a chave aponta para a propria lista do termo (sem copia); na
 * fusao cria-se uma lista nova, entao a do indice exato nunca e alterada.
 */
function juntar(mapa, chave, pesos) {
  const atual = mapa.get(chave);
  if (atual === undefined) { mapa.set(chave, pesos); return; }
  const lista = atual.slice();
  for (const p of pesos) {
    let i = -1;
    for (let k = 0; k < lista.length; k++) if (lista[k].categoria === p.categoria) { i = k; break; }
    if (i < 0) lista.push(p);
    else if (lista[i].peso < p.peso) lista[i] = p;
  }
  mapa.set(chave, lista);
}

function chaveBalde(letra, tamanho) {
  return letra.charCodeAt(0) * 1000 + tamanho;
}

function maiorPeso(pesos) {
  let m = -Infinity;
  for (const p of pesos) if (p.peso > m) m = p.peso;
  return m;
}

/**
 * [cat, val, cat, val...] em ordem de insercao -> lista de Peso na ordem de
 * iteracao de um HashMap<Integer, Integer>(4) do Java.
 */
function pesosEmOrdemJava(plano) {
  const n = plano.length / 2;
  const cap = capacidadeFinal(4, n);
  const itens = [];
  for (let i = 0; i < plano.length; i += 2) itens.push({ categoria: plano[i], peso: plano[i + 1] });
  if (n <= 1) return itens;
  return ordenarComoJava(itens, p => hashInt(p.categoria), cap);
}

export class Vocabulario {
  /**
   * @param {Array<{id:number,nome:string,emoji:string,grupo:string}>} categorias
   * @param {Map<string, Array<{categoria:number,peso:number}>>} indice
   */
  constructor(categorias, indice) {
    this.categorias = categorias;
    this._indice = indice;
    // Os indices 'sem cola' e 'por radical' saem do indice exato numa passada
    // so, na primeira frase (ou em preparar()): tira ~100 ms da carga.
    this._semColaMap = null;
    this._radicalMap = null;
    this._porId = new Map(categorias.map(c => [c.id, c]));
    this._cache = {};
  }

  /**
   * Le o dicionario do formato compacto. Cada linha e um split e nada mais:
   * nada de JSON, que custava segundos no Android e custaria no navegador.
   * @param {string} texto conteudo inteiro de vocabulario.txt
   * @returns {Vocabulario}
   */
  static carregar(texto) {
    const cats = [];
    const indice = new Map();

    const linhas = texto.split('\n');
    for (let li = 0; li < linhas.length; li++) {
      const linha = linhas[li];
      let len = linha.length;
      if (len && linha.charCodeAt(len - 1) === 13) len--; // CRLF
      if (len < 3) continue;
      const tipo = linha.charCodeAt(0);
      if (tipo === 84 /* T */) {
        const corte = linha.indexOf('|', 2);
        if (corte <= 2 || corte >= len) continue;
        const termo = linha.substring(2, corte);
        // "cat:peso,cat:peso" lido digito a digito (sem substring/parseInt).
        const pesos = [];
        let cat = 0, peso = 0, digCat = 0, digPeso = 0, noPeso = false;
        for (let i = corte + 1; i <= len; i++) {
          const c = i < len ? linha.charCodeAt(i) : 44;
          if (c === 44 /* , */) {
            if (noPeso && digCat > 0 && digPeso > 0) pesos.push({ categoria: cat, peso });
            cat = 0; peso = 0; digCat = 0; digPeso = 0; noPeso = false;
          } else if (c === 58 /* : */) {
            noPeso = true;
          } else if (c >= 48 && c <= 57) {
            if (noPeso) { peso = peso * 10 + (c - 48); digPeso++; } else { cat = cat * 10 + (c - 48); digCat++; }
          }
        }
        if (pesos.length === 0) continue;
        indice.set(termo, pesos);
      } else if (tipo === 67 /* C */) {
        const p = linha.substring(0, len).split('|');
        if (p.length >= 5) cats.push({ id: parseInt(p[1], 10), nome: p[2], emoji: p[3], grupo: p[4] });
      }
    }
    cats.sort((x, y) => x.id - y.id);
    return new Vocabulario(cats, indice);
  }

  /**
   * Os indices 'sem cola' e 'por radical', montados como o Kotlin monta na
   * carga: linha a linha, na ordem do arquivo (= ordem de insercao do Map).
   */
  _montarIndicesDaCarga() {
    const semColaMap = new Map();
    const radicalMap = new Map();
    for (const [termo, pesos] of this._indice) {
      if (termo.indexOf(' ') >= 0) {
        const sem = semCola(termo);
        if (sem.length && sem !== termo) juntar(semColaMap, sem, pesos);
      } else if (termo.length >= 6) {
        // Radical so de termo de uma palavra (termo solto: semCola devolve ele mesmo).
        const r = Radicais.de(termo);
        if (r.length >= 4) juntar(radicalMap, r, pesos);
      }
    }
    this._semColaMap = semColaMap;
    this._radicalMap = radicalMap;
  }

  /** O mesmo termo sem as preposicoes, para casar frase escrita por gente. */
  get _indiceSemCola() {
    if (!this._semColaMap) this._montarIndicesDaCarga();
    return this._semColaMap;
  }

  /** Radical de termo de uma palavra: 'lent' -> Suporte de Informatica. */
  get _indiceRadical() {
    if (!this._radicalMap) this._montarIndicesDaCarga();
    return this._radicalMap;
  }

  /** Quantos termos distintos o dicionario conhece. */
  get tamanho() { return this._indice.size; }

  /** Termos que mais de uma categoria reivindica: viram pergunta, nao chute. */
  get ambiguos() {
    if (!this._cache.ambiguos) {
      const amb = new Map();
      for (const [termo, pesos] of this._indice) {
        if (pesos.length > 1) amb.set(termo, pesos.map(p => p.categoria));
      }
      this._cache.ambiguos = amb;
    }
    return this._cache.ambiguos;
  }

  pesosDe(termo) { return this._indice.get(termo) || []; }

  categoria(id) { return this._porId.get(id) || null; }

  /**
   * Monta de uma vez todas as estruturas preguicosas (o Kotlin monta na
   * primeira frase). Opcional: chame depois de carregar — num requestIdleCallback,
   * por exemplo — para a primeira busca nao pagar.
   */
  preparar() {
    if (!this._semColaMap) this._montarIndicesDaCarga();
    this._derivar();
    this._indiceRadicalDentro();
    return this;
  }

  // ------------------------------------------------------------ preguicosos

  /**
   * Uma passada so pelo indice, na ordem de iteracao do HashMap(32768) do
   * Kotlin, montando o que no app sao cinco `by lazy`: nucleos, palavrasFortes,
   * palavrasConhecidas (+ baldes) e indiceDentroDeTermo. Cada um sai na mesma
   * ordem em que o Kotlin o montaria — e a ordem que decide os empates.
   */
  _derivar() {
    const c = this._cache;
    if (c.derivado) return c;
    const ordemIndice = ordenarComoJava(Array.from(this._indice.entries()), e => hashString(e[0]), 32768);

    const nucleos = [];
    const fortes = new Map();
    const conhecidas = new Set();
    // porPalavra: palavra -> [cat, val, cat, val, ...] em ordem de insercao
    const porPalavra = new Map();

    for (let x = 0; x < ordemIndice.length; x++) {
      const termo = ordemIndice[x][0];
      const pesos = ordemIndice[x][1];
      if (termo.indexOf(' ') < 0) {
        const len = termo.length;
        if (len >= 3) conhecidas.add(termo);
        if (len < 4) continue;
        let maior = pesos[0];
        for (let k = 1; k < pesos.length; k++) if (pesos[k].peso > maior.peso) maior = pesos[k];
        if (maior.peso >= 4) {
          const kb = chaveBalde(termo[0], len);
          let l = fortes.get(kb);
          if (!l) { l = []; fortes.set(kb, l); }
          l.push([termo, pesos]);
        }
        if (len >= 5 && maior.peso >= PESO_NUCLEO) nucleos.push([termo, maior.categoria]);
      } else {
        const partes = termo.split(' ');
        for (let w = 0; w < partes.length; w++) {
          const palavra = partes[w];
          if (palavra.length >= 3) conhecidas.add(palavra);
          if (palavra.length < 5 || COLA.has(palavra)) continue;
          let mapa = porPalavra.get(palavra);
          if (!mapa) { mapa = []; porPalavra.set(palavra, mapa); }
          for (let k = 0; k < pesos.length; k++) {
            const p = pesos[k];
            const meio = Math.max(2, Math.trunc(p.peso / 2));
            let i = 0;
            while (i < mapa.length && mapa[i] !== p.categoria) i += 2;
            if (i >= mapa.length) mapa.push(p.categoria, meio);
            else if (mapa[i + 1] < meio) mapa[i + 1] = meio;
          }
        }
      }
    }

    // palavrasConhecidas e um HashSet(65536): os baldes seguem a ordem dele.
    const baldes = new Map();
    for (const p of ordenarComoJava(Array.from(conhecidas), hashString, 65536)) {
      if (p.length < 4) continue;
      const kb = chaveBalde(p[0], p.length);
      let l = baldes.get(kb);
      if (!l) { l = []; baldes.set(kb, l); }
      l.push(p);
    }

    // indiceDentroDeTermo: so palavras de ate quatro categorias, na ordem do
    // HashMap(16384) porPalavra; dentro, a ordem do HashMap<Int,Int>(4).
    const dentro = new Map();
    const ordemPalavras = ordenarComoJava(Array.from(porPalavra.keys()), hashString, 16384);
    for (const palavra of ordemPalavras) {
      const mapa = porPalavra.get(palavra);
      if (mapa.length > 8) continue;
      dentro.set(palavra, pesosEmOrdemJava(mapa));
    }

    c.nucleos = nucleos;
    c.palavrasFortes = fortes;
    c.conhecidas = conhecidas;
    c.baldes = baldes;
    c.dentro = dentro;
    c.derivado = true;
    return c;
  }

  /** So os nomes de profissao, para o casamento aproximado (o caro). */
  _nucleos() { return this._derivar().nucleos; }

  /** Palavras soltas com peso >= 4, por (primeira letra, tamanho). */
  _palavrasFortes() { return this._derivar().palavrasFortes; }

  /** Palavra distintiva que so existe dentro de termos compostos (meio peso). */
  _indiceDentroDeTermo() { return this._derivar().dentro; }

  /** Toda palavra que aparece em qualquer termo, inclusive dentro dos compostos. */
  _palavrasConhecidas() { return this._derivar().conhecidas; }

  /** Palavras conhecidas por (primeira letra, tamanho), para consertar grafia. */
  _baldesConhecidos() { return this._derivar().baldes; }

  /** O mesmo indice de palavra-dentro-de-termo, mas por radical. */
  _indiceRadicalDentro() {
    let v = this._cache.radicalDentro;
    if (!v) {
      const mapa = new Map();
      for (const [palavra, pesos] of this._indiceDentroDeTermo()) {
        const r = Radicais.de(palavra);
        if (r.length < 5) continue;
        let alvo = mapa.get(r);
        if (!alvo) { alvo = []; mapa.set(r, alvo); }
        for (const p of pesos) {
          let i = 0;
          while (i < alvo.length && alvo[i] !== p.categoria) i += 2;
          if (i >= alvo.length) alvo.push(p.categoria, p.peso);
          else if (alvo[i + 1] < p.peso) alvo[i + 1] = p.peso;
        }
      }
      v = new Map();
      for (const [r, alvo] of mapa) v.set(r, pesosEmOrdemJava(alvo));
      this._cache.radicalDentro = v;
    }
    return v;
  }

  // ------------------------------------------------------------ conserto

  /** As grafias certas mais proximas desta palavra, da melhor para a pior. */
  _grafiasProximas(palavra, quantas = 4) {
    const folga = palavra.length === 4 ? 1 : Aproximado.folgaDe(palavra);
    if (folga <= 0) return [];
    const baldes = this._baldesConhecidos();
    const achadas = [];
    const varrer = (letra) => {
      for (let t = palavra.length - folga; t <= palavra.length + folga; t++) {
        const balde = baldes.get(chaveBalde(letra, t));
        if (!balde) continue;
        for (const termo of balde) {
          const d = Aproximado.distancia(palavra, termo, folga);
          if (d <= folga) achadas.push([termo, d]);
        }
      }
    };
    varrer(palavra[0]);
    if (achadas.length === 0 && palavra.length > 4) varrer(palavra[1]);
    achadas.sort((x, y) => (x[1] - y[1]) || (y[0].length - x[0].length));
    const saida = [];
    const vistos = new Set();
    for (const [t] of achadas) {
      if (vistos.has(t)) continue;
      vistos.add(t);
      saida.push(t);
      if (saida.length >= quantas) break;
    }
    return saida;
  }

  /** A palavra sem a letra repetida, se isso a torna conhecida. */
  _desdobrar(palavra) {
    let tem = false;
    for (let i = 1; i < palavra.length; i++) if (palavra[i] === palavra[i - 1]) { tem = true; break; }
    if (!tem) return null;
    const conhecidas = this._palavrasConhecidas();
    let sb = '';
    let repetidas = 1;
    for (let i = 0; i < palavra.length; i++) {
      if (i > 0 && palavra[i] === palavra[i - 1]) repetidas++; else repetidas = 1;
      if (repetidas <= 2) sb += palavra[i];
    }
    if (sb !== palavra && conhecidas.has(sb)) return sb;
    for (let i = 1; i < palavra.length; i++) {
      if (palavra[i] !== palavra[i - 1]) continue;
      const tentativa = palavra.substring(0, i) + palavra.substring(i + 1);
      if (conhecidas.has(tentativa)) return tentativa;
    }
    return null;
  }

  /** O trecho existe no dicionario (com ou sem as preposicoes)? */
  _conhece(...partes) {
    for (const p of partes) if (p == null) return false;
    const texto = partes.join(' ');
    return this._indice.has(texto) || this._indiceSemCola.has(texto);
  }

  _ladoVale(p) {
    return this._palavrasConhecidas().has(p) || COLA.has(p) || VAZIAS.has(p) || ENCHIMENTO.has(p);
  }

  _descartavel(p) {
    return COLA.has(p) || VAZIAS.has(p) || ENCHIMENTO.has(p);
  }

  /** O texto separado ("manutencaode" -> "manutencao de"), sem exigir termo. */
  _separarTexto(palavra, antes, depois) {
    if (palavra.length < 5) return null;
    const validos = [];
    for (let corte = 2; corte <= palavra.length - 2; corte++) {
      const esquerda = palavra.substring(0, corte);
      const direita = palavra.substring(corte);
      if (this._ladoVale(esquerda) && this._ladoVale(direita)) validos.push([esquerda, direita]);
    }
    if (validos.length === 0) return null;
    const comContexto = validos.find(([e, d]) =>
      this._conhece(antes, e, d) || this._conhece(e, d, depois) ||
      this._conhece(antes, e) || this._conhece(d, depois) || this._conhece(e, d));
    const [esquerda, direita] = comContexto || validos[0];
    const esqVazia = this._descartavel(esquerda);
    const dirVazia = this._descartavel(direita);
    if (esqVazia && !dirVazia) return direita;
    if (dirVazia && !esqVazia) return esquerda;
    return esquerda + ' ' + direita;
  }

  /** "vazamentona" -> ["vazamento na", pesos] ou o lado forte mais longo. */
  _separarColadas(palavra) {
    if (palavra.length < 6) return null;
    const conhecidas = this._palavrasConhecidas();
    let melhor = null;
    for (let corte = 2; corte <= palavra.length - 2; corte++) {
      const esquerda = palavra.substring(0, corte);
      const direita = palavra.substring(corte);
      const esqOk = conhecidas.has(esquerda) || COLA.has(esquerda);
      const dirOk = conhecidas.has(direita) || COLA.has(direita);
      if (esqOk && dirOk) {
        const pesos = this._indice.get(esquerda) || this._indice.get(direita);
        if (pesos) return [esquerda + ' ' + direita, pesos];
      }
      for (const lado of [esquerda, direita]) {
        if (lado.length < 4) continue;
        const pesos = this._indice.get(lado);
        if (!pesos) continue;
        if (!pesos.some(p => p.peso >= 4)) continue;
        if (melhor == null || lado.length > melhor[0].length) melhor = [lado, pesos];
      }
    }
    return melhor;
  }

  /** A palavra do dicionario mais parecida com esta (so entre as fortes). */
  _palavraParecida(palavra) {
    const folga = palavra.length === 4 ? 1 : Aproximado.folgaDe(palavra);
    if (folga <= 0) return null;
    const fortes = this._palavrasFortes();
    let melhor = null;
    let melhorForte = 0;
    let melhorDistancia = folga + 1;
    const varrer = (letra) => {
      for (let t = palavra.length - folga; t <= palavra.length + folga; t++) {
        const balde = fortes.get(chaveBalde(letra, t));
        if (!balde) continue;
        for (const par of balde) {
          const d = Aproximado.distancia(palavra, par[0], folga);
          if (d > folga) continue;
          const forte = maiorPeso(par[1]);
          const atualForte = melhor ? melhorForte : 0;
          if (d < melhorDistancia || (d === melhorDistancia && forte > atualForte)) {
            melhorDistancia = d;
            melhor = par;
            melhorForte = forte;
          }
        }
      }
    };
    varrer(palavra[0]);
    if (melhor == null && palavra.length > Aproximado.MENOR_PALAVRA) varrer(palavra[1]);
    return melhor;
  }

  _maisParecido(palavra) {
    const folga = Aproximado.folgaDe(palavra);
    if (folga <= 0) return null;
    const nucleos = this._nucleos();
    let melhor = null;
    let melhorDistancia = folga + 1;
    for (const par of nucleos) {
      const d = Aproximado.distancia(palavra, par[0], folga);
      if (d < melhorDistancia) {
        melhorDistancia = d;
        melhor = par;
        if (d === 0) break;
      }
    }
    if (melhor) return melhor;
    for (const par of nucleos) {
      if (Radicais.mesmaFamilia(palavra, par[0])) return par;
    }
    return null;
  }

  // ------------------------------------------------------------ publico

  /**
   * Termos do dicionario que aparecem na frase, do mais especifico para o menos.
   * @param {string[]} palavras ja normalizadas
   * @returns {Array<{termo:string, pesos:Array<{categoria:number,peso:number}>, palavrasCobertas:number, exato:boolean}>}
   */
  acertos(palavras) {
    const usadas = new Array(palavras.length).fill(false);
    const saida = [];
    const conhecidas = this._palavrasConhecidas();

    const uteis = [];
    const origem = [];
    for (let i = 0; i < palavras.length; i++) {
      if (COLA.has(palavras[i])) continue;
      uteis.push(palavras[i]);
      origem.push(i);
    }

    // Primeiro conserta a palavra, depois casa a frase.
    const consertadas = [];
    const trocadas = new Array(uteis.length).fill(false);
    for (let k = 0; k < uteis.length; k++) {
      const p = uteis[k];
      if (p.length < 4 || conhecidas.has(p) || VAZIAS.has(p)) {
        consertadas.push(p);
        continue;
      }
      const semDobra = this._desdobrar(p);
      if (semDobra != null) {
        consertadas.push(semDobra); trocadas[k] = true; continue;
      }
      const texto = this._separarTexto(p, uteis[k - 1], uteis[k + 1]);
      if (texto != null) {
        consertadas.push(texto); trocadas[k] = true; continue;
      }
      const colada = this._separarColadas(p);
      if (colada != null) {
        consertadas.push(colada[0]); trocadas[k] = true; continue;
      }
      const vizinhoAntes = uteis[k - 1];
      const vizinhoDepois = uteis[k + 1];
      const candidatas = this._grafiasProximas(p);
      const antes2 = uteis[k - 2];
      const depois2 = uteis[k + 2];
      const comContexto = candidatas.find(c =>
        this._conhece(vizinhoAntes, c) || this._conhece(c, vizinhoDepois) ||
        this._conhece(antes2, vizinhoAntes, c) ||
        this._conhece(vizinhoAntes, c, vizinhoDepois) ||
        this._conhece(c, vizinhoDepois, depois2));
      const grafia = comContexto !== undefined ? comContexto : candidatas[0];
      if (grafia != null) {
        consertadas.push(grafia); trocadas[k] = true; continue;
      }
      const parecida = this._palavraParecida(p);
      if (parecida != null) {
        consertadas.push(parecida[0]); trocadas[k] = true; continue;
      }
      consertadas.push(p);
    }

    for (const n of ngramas(consertadas)) {
      let ocupado = false;
      for (let t = n.de; t < n.ate; t++) if (usadas[origem[t]]) { ocupado = true; break; }
      if (ocupado) continue;
      const pesos = this._indice.get(n.texto) || this._indiceSemCola.get(n.texto);
      if (!pesos) continue;
      for (let i = origem[n.de]; i <= origem[n.ate - 1]; i++) usadas[i] = true;
      let exato = true;
      for (let t = n.de; t < n.ate; t++) if (trocadas[t]) { exato = false; break; }
      saida.push({ termo: n.texto, pesos, palavrasCobertas: n.ate - n.de, exato });
    }

    // So se nada casou com duas palavras ou mais (nem nome de profissao).
    const forte = saida.some(a => a.palavrasCobertas >= 2 || a.pesos.some(p => p.peso >= PESO_NUCLEO));
    if (!forte) {
      const dentroDeTermo = this._indiceDentroDeTermo();
      const radicalDentro = this._indiceRadicalDentro();
      for (let k = 0; k < uteis.length; k++) {
        const i = origem[k];
        if (usadas[i]) continue;
        const p = uteis[k];
        if (p.length < Aproximado.MENOR_PALAVRA || VAZIAS.has(p)) continue;

        // Palavra que o dicionario conhece nao vira chute.
        if (conhecidas.has(p)) {
          const dentroExato = dentroDeTermo.get(p);
          if (dentroExato) {
            usadas[i] = true;
            saida.push({ termo: p, pesos: dentroExato, palavrasCobertas: 1, exato: true });
            continue;
          }
        }
        const radical = Radicais.de(p);
        const porRadical = radical.length >= 5 ? this._indiceRadical.get(radical) : undefined;
        if (porRadical) {
          usadas[i] = true;
          saida.push({ termo: p, pesos: porRadical, palavrasCobertas: 1, exato: false });
          continue;
        }
        const parecida = this._palavraParecida(p);
        if (parecida) {
          usadas[i] = true;
          saida.push({ termo: parecida[0], pesos: parecida[1], palavrasCobertas: 1, exato: false });
          continue;
        }
        const dentro = dentroDeTermo.get(p);
        if (dentro) {
          usadas[i] = true;
          saida.push({ termo: p, pesos: dentro, palavrasCobertas: 1, exato: false });
          continue;
        }
        const rDentro = radical.length >= 5 ? radicalDentro.get(radical) : undefined;
        if (rDentro) {
          usadas[i] = true;
          saida.push({ termo: p, pesos: rDentro, palavrasCobertas: 1, exato: false });
          continue;
        }
        const separada = this._separarColadas(p);
        if (separada) {
          usadas[i] = true;
          saida.push({ termo: separada[0], pesos: separada[1], palavrasCobertas: 1, exato: false });
          continue;
        }
        const perto = this._maisParecido(p);
        if (!perto) continue;
        usadas[i] = true;
        saida.push({ termo: perto[0], pesos: this._indice.get(perto[0]) || [], palavrasCobertas: 1, exato: false });
      }
    }
    return saida;
  }

  /**
   * Ultimo recurso: quando nada casou, quais categorias a frase mais parece ter citado?
   * @returns {number[]} ids de categoria
   */
  palpites(palavras, maximo = 3, minimo = 6) {
    const pontos = new Map();
    const fortes = this._palavrasFortes();
    for (const p of palavras) {
      if (p.length < 4 || VAZIAS.has(p) || COLA.has(p)) continue;
      const folga = p.length >= 7 ? 3 : 2;
      let melhor = null;
      let melhorD = folga + 1;
      for (const letra of [p[0], p[1] !== undefined ? p[1] : p[0]]) {
        for (let t = p.length - folga; t <= p.length + folga; t++) {
          const balde = fortes.get(chaveBalde(letra, t));
          if (!balde) continue;
          for (const par of balde) {
            const d = Aproximado.distancia(p, par[0], folga);
            if (d < melhorD) { melhorD = d; melhor = par; }
          }
        }
      }
      if (!melhor) continue;
      for (const peso of melhor[1]) {
        pontos.set(peso.categoria, (pontos.get(peso.categoria) || 0) + peso.peso);
      }
    }
    if (pontos.size === 0) return [];
    let teto = -Infinity;
    for (const v of pontos.values()) if (v > teto) teto = v;
    if (teto < minimo) return [];
    const corte = Math.trunc(teto * 2 / 3);
    return ordenarComoJava(Array.from(pontos.entries()), e => hashInt(e[0]), 16)
      .filter(e => e[1] >= corte)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maximo)
      .map(e => e[0]);
  }
}

export default Vocabulario;
