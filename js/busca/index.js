// Ponto de entrada unico do motor de busca por frase do Trampo2 (porte do Kotlin).
//
//   import { Vocabulario, interpretar, etiquetas, sem, melhorAlternativa, aplicar, filtroDe }
//     from './js/busca/index.js';
//   const vocab = Vocabulario.carregar(await (await fetch('data/vocabulario.txt')).text());
//   const i = interpretar('vazamento na pia urgente perto de mim', vocab);

export { Vocabulario, COLA, ENCHIMENTO, PESO_NUCLEO } from './vocabulario.js';
export { interpretar, melhorAlternativa, BAIRROS, CIDADES } from './interpretador.js';
export { IntencaoBusca, Ordem, Campo, ROTULO_ORDEM, EMOJI_ORDEM, sem, etiquetas, pergunta } from './intencao.js';
export {
  aplicar, ordenar, aplicarMural, distanciaDoPedido, idade, filtro, filtroDe, pontuacao,
  distanciaKm, distanciaAte, atendeAgora, taxaResposta, taxaRapidez, temPreco, pedidoVenceu, Busca
} from './busca.js';
export { CATEGORIAS, MAIS_PEDIDAS, categoria, porGrupo } from './categorias.js';
export { Texto, norm, palavras, ngramas, contem, VAZIAS } from './texto.js';
export { Radicais } from './radicais.js';
export { Aproximado } from './aproximado.js';
