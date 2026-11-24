// Emulacao da ordem de iteracao do java.util.HashMap / HashSet.
//
// O Kotlin desempata muita coisa pela ordem em que um HashMap devolve as
// chaves: o primeiro termo parecido encontrado num balde, a categoria que vem
// antes num empate de pontos, o primeiro nucleo a distancia zero. Um Map do JS
// itera na ordem de insercao, que e outra. Para o porte dar exatamente a mesma
// resposta que o app Android, as estruturas derivadas sao montadas na ordem que
// o Java usaria:
//
//   balde = (h ^ (h >>> 16)) & (capacidade - 1), e dentro do balde a ordem de
//   insercao (o resize do Java divide cada balde preservando a ordem relativa).
//
// A capacidade final depende so da capacidade inicial e do tamanho final.

/** String.hashCode() do Java. */
export function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

/** Integer.hashCode() do Java. */
export function hashInt(n) {
  return n | 0;
}

function espalhar(h) {
  return h ^ (h >>> 16);
}

/** HashMap.tableSizeFor: proxima potencia de dois. */
function tamanhoTabela(n) {
  let c = 1;
  while (c < n) c *= 2;
  return c;
}

/** Capacidade final de um HashMap(inicial) depois de receber `tamanho` chaves. */
export function capacidadeFinal(inicial, tamanho) {
  let cap = tamanhoTabela(inicial <= 0 ? 1 : inicial);
  while (tamanho > Math.floor(cap * 0.75)) cap *= 2;
  return cap;
}

/**
 * Reordena itens (em ordem de insercao) na ordem de iteracao de um HashMap
 * Java com a capacidade inicial dada. `hashDe(item)` devolve o hashCode Java.
 */
export function ordenarComoJava(itens, hashDe, inicial = 16) {
  const n = itens.length;
  if (n <= 1) return itens.slice();
  const cap = capacidadeFinal(inicial, n);
  const mascara = cap - 1;
  const baldes = new Int32Array(n);
  for (let i = 0; i < n; i++) baldes[i] = espalhar(hashDe(itens[i])) & mascara;
  if (cap > n * 4) {
    // Poucos itens para muitos baldes: ordenacao estavel comum.
    const idx = Array.from({ length: n }, (_, i) => i);
    idx.sort((x, y) => (baldes[x] - baldes[y]) || (x - y));
    return idx.map(i => itens[i]);
  }
  // Counting sort estavel por balde.
  const conta = new Int32Array(cap + 1);
  for (let i = 0; i < n; i++) conta[baldes[i] + 1]++;
  for (let b = 0; b < cap; b++) conta[b + 1] += conta[b];
  const saida = new Array(n);
  for (let i = 0; i < n; i++) saida[conta[baldes[i]]++] = itens[i];
  return saida;
}

/** Entradas [chave, valor] de um Map<int,*> na ordem de um HashMap<Integer,*> Java. */
export function entradasInt(mapa, inicial = 16) {
  return ordenarComoJava(Array.from(mapa.entries()), e => hashInt(e[0]), inicial);
}

/** Entradas [chave, valor] de um Map<string,*> na ordem de um HashMap<String,*> Java. */
export function entradasString(mapa, inicial = 16) {
  return ordenarComoJava(Array.from(mapa.entries()), e => hashString(e[0]), inicial);
}
