// Porte de entrada/Aproximado.kt — comparacao tolerante a erro de digitacao e de ditado.
//
// A folga cresce com o tamanho da palavra: palavra curta com uma letra de folga
// vira outra coisa ("cera" -> "cara"), palavra longa nao.

/** Abaixo disso nao vale arriscar palpite nenhum. */
export const MENOR_PALAVRA = 5;

/** Quantas letras podem estar erradas numa palavra desse tamanho. */
export function folgaDe(palavra) {
  if (palavra.length >= 9) return 2;
  if (palavra.length >= MENOR_PALAVRA) return 1;
  return 0;
}

/** As duas palavras sao a mesma coisa escrita com um errinho? */
export function parecidas(a, b, folga = folgaDe(b)) {
  if (folga <= 0) return a === b;
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > folga) return false;
  return distancia(a, b, folga) <= folga;
}

// Buffers reaproveitados: a distancia roda milhares de vezes por frase.
let bufA = new Int32Array(64);
let bufB = new Int32Array(64);
let bufC = new Int32Array(64);

/**
 * Distancia de edicao com teto. Troca de duas letras vizinhas custa 1
 * (Damerau restrito). Devolve limite + 1 quando estoura.
 */
export function distancia(a, b, limite) {
  const estourou = limite + 1;
  if (Math.abs(a.length - b.length) > limite) return estourou;

  const largura = b.length + 1;
  if (bufA.length < largura) {
    const n = Math.max(largura, bufA.length * 2);
    bufA = new Int32Array(n); bufB = new Int32Array(n); bufC = new Int32Array(n);
  }
  let anteriores = bufA;
  let anterior = bufB;
  let atual = bufC;
  for (let j = 0; j < largura; j++) { anteriores[j] = 0; anterior[j] = j; atual[j] = 0; }

  const la = a.length;
  const lb = b.length;
  for (let i = 1; i <= la; i++) {
    atual[0] = i;
    let menorNaLinha = i;
    const ai = a.charCodeAt(i - 1);
    const ai2 = i > 1 ? a.charCodeAt(i - 2) : -1;
    for (let j = 1; j <= lb; j++) {
      const bj = b.charCodeAt(j - 1);
      const custo = ai === bj ? 0 : 1;
      let valor = atual[j - 1] + 1;
      const v2 = anterior[j] + 1;
      if (v2 < valor) valor = v2;
      const v3 = anterior[j - 1] + custo;
      if (v3 < valor) valor = v3;
      if (i > 1 && j > 1 && ai === b.charCodeAt(j - 2) && ai2 === bj) {
        const v4 = anteriores[j - 2] + 1;
        if (v4 < valor) valor = v4;
      }
      atual[j] = valor;
      if (valor < menorNaLinha) menorNaLinha = valor;
    }
    if (menorNaLinha > limite) return estourou;
    const troca = anteriores;
    anteriores = anterior;
    anterior = atual;
    atual = troca;
  }
  const r = anterior[lb];
  return r < estourou ? r : estourou;
}

export const Aproximado = { MENOR_PALAVRA, folgaDe, parecidas, distancia };
export default Aproximado;
