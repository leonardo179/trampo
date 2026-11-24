// Porte de entrada/Texto.kt — normalizacao unica da busca.
//
// Tudo que entra pela busca (teclado, ditado, cartao do mural) passa por aqui
// antes de virar comparacao. Se dois pontos normalizassem diferente, a mesma
// palavra acharia o profissional numa tela e nao na outra.

const RE_MARCAS = /\p{Mn}+/gu;

/** Minusculo, sem acento, so letra e numero, espaco simples. */
export function norm(s) {
  if (s == null) return '';
  const semAcento = String(s).toLowerCase().normalize('NFD').replace(RE_MARCAS, '');
  let out = '';
  let espaco = true; // comeca "em espaco" para descartar espacos iniciais
  for (let i = 0; i < semAcento.length; i++) {
    const c = semAcento.charCodeAt(i);
    if ((c >= 97 && c <= 122) || (c >= 48 && c <= 57)) {
      out += semAcento[i];
      espaco = false;
    } else if (!espaco) {
      out += ' ';
      espaco = true;
    }
  }
  return espaco && out.length ? out.slice(0, -1) : out;
}

export function palavras(s) {
  const n = norm(s);
  return n ? n.split(' ') : [];
}

/**
 * Todas as sequencias de 1 a `maximo` palavras, da maior para a menor.
 * Procurar primeiro o termo longo evita que o curto roube o casamento.
 */
export function ngramas(lista, maximo = 5) {
  const saida = [];
  for (let tam = Math.min(maximo, lista.length); tam >= 1; tam--) {
    for (let i = 0; i <= lista.length - tam; i++) {
      saida.push({ de: i, ate: i + tam, texto: lista.slice(i, i + tam).join(' ') });
    }
  }
  return saida;
}

/** O termo aparece na frase respeitando fronteira de palavra? */
export function contem(fraseNorm, termo) {
  if (!termo) return false;
  let i = fraseNorm.indexOf(termo);
  while (i >= 0) {
    const antesOk = i === 0 || fraseNorm[i - 1] === ' ';
    const fim = i + termo.length;
    const depoisOk = fim === fraseNorm.length || fraseNorm[fim] === ' ';
    if (antesOk && depoisOk) return true;
    i = fraseNorm.indexOf(termo, i + 1);
  }
  return false;
}

/** Palavras de ligacao que nunca ajudam a identificar servico. */
export const VAZIAS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'as', 'os', 'um', 'uma', 'uns',
  'umas', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'pra', 'pro', 'com',
  'sem', 'que', 'e', 'ou', 'me', 'meu', 'minha', 'eu', 'voce', 'vc', 'se',
  'ai', 'aqui', 'la', 'ta', 'to', 'tou', 'esta', 'estou', 'ser', 'tem',
  'ter', 'muito', 'mais', 'menos', 'ja', 'so', 'tambem', 'algum', 'alguma',
  'alguem', 'qual', 'quais', 'onde', 'quando', 'como', 'favor', 'obrigado'
]);

export const Texto = { norm, palavras, ngramas, contem, VAZIAS };
export default Texto;
