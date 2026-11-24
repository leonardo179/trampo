// Porte de entrada/Radicais.kt — radical aproximado de uma palavra em portugues.
//
// "pintura", "pintar", "pintor" precisam cair no mesmo radical. Nao e um
// stemmer de verdade: corta plural e as terminacoes mais comuns, sempre
// exigindo que sobre raiz suficiente.

const PLURAIS = [
  ['oes', 'ao'], ['aes', 'ao'], ['ais', 'al'],
  ['eis', 'el'], ['ois', 'ol'], ['ns', 'm']
];

/** Terminacoes cortadas, da maior para a menor (ordenacao estavel, como no Kotlin). */
const SUFIXOS = [
  'aremos', 'eremos', 'iremos', 'assem', 'essem', 'issem',
  'ariam', 'eriam', 'iriam', 'aram', 'eram', 'iram', 'amos', 'emos',
  'imos', 'ando', 'endo', 'indo', 'acao', 'icao', 'mento', 'dor', 'dora',
  'eiro', 'eira', 'ista', 'ada', 'ado', 'ida', 'ido', 'ava', 'ei', 'eu',
  'ou', 'ar', 'er', 'ir', 'am', 'em', 'es', 'as', 'os', 'a', 'e', 'o', 'i'
].map((s, i) => [s, i])
  .sort((x, y) => (y[0].length - x[0].length) || (x[1] - y[1]))
  .map(x => x[0]);

/** Raiz minima que ainda diz alguma coisa. */
const MINIMO = 3;

export function de(palavra) {
  let t = palavra.toLowerCase();
  if (t.length <= MINIMO) return t;

  for (const [fim, troca] of PLURAIS) {
    if (t.endsWith(fim) && t.length - fim.length + troca.length >= MINIMO) {
      t = t.slice(0, t.length - fim.length) + troca;
      break;
    }
  }
  if (t.endsWith('s') && t.length - 1 >= MINIMO + 1) t = t.slice(0, -1);

  for (const s of SUFIXOS) {
    if (t.endsWith(s) && t.length - s.length >= MINIMO) {
      t = t.slice(0, t.length - s.length);
      break;
    }
  }
  return t;
}

/** As duas palavras vem da mesma familia? ("pintar" e "pintor" vem.) */
export function mesmaFamilia(a, b) {
  const ra = de(a);
  const rb = de(b);
  return ra.length >= 4 && ra === rb;
}

export const Radicais = { de, mesmaFamilia };
export default Radicais;
