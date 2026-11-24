// Porte de entrada/InterpretadorBusca.kt + entrada/MelhorAlternativa.kt.
//
// Le uma frase solta e devolve uma busca pronta. A ordem do trabalho nao e
// detalhe:
//  1. primeiro os marcadores, do mais longo para o mais curto ("tenho cachorro
//     em casa" vence a palavra solta "cachorro");
//  2. depois a categoria, no que sobrou, exato antes do aproximado;
//  3. bairro/cidade por ultimo ("portao" e bairro de Curitiba, mas quase sempre
//     e o portao que parou de abrir);
//  4. o resto vira texto livre.
// Quando duas categorias empatam, nada de chutar: as duas voltam em
// `candidatas` e quem decide e a pessoa.

import * as Texto from './texto.js';
import { IntencaoBusca, Ordem, Campo, ROTULO_ORDEM, EMOJI_ORDEM } from './intencao.js';
import { ordenarComoJava, hashInt } from './ordemjava.js';

/** Abaixo disso a prova e fraca demais para decidir sozinha. */
const PONTOS_CONFIAVEIS = 16;

// ------------------------------------------------------------ marcadores

const URGENCIA = [
  'o mais rapido possivel', 'nao pode esperar', 'nao da pra esperar',
  'preciso pra hoje', 'pra hoje ainda', 'ainda hoje', 'hoje mesmo',
  'no mesmo dia', 'o quanto antes', 'de emergencia', 'com urgencia',
  'to com pressa', 'estou com pressa', 'to no aperto', 'de madrugada',
  'hoje a noite', 'pra agora', 'agora mesmo', 'pra ja', 'pra ontem',
  'as pressas', 'e urgente', 'urgente mesmo', 'urgentissimo', 'urgente',
  'urgencia', 'emergencia', 'socorro', 'plantao', 'imediatamente',
  'imediato', '24 horas', '24h', 'pra hoje', 'correndo', 'agora'
];

const PERTO = [
  'o mais perto possivel', 'que venha ate aqui', 'que atenda em casa',
  'perto do meu trabalho', 'aqui na vizinhanca', 'na vizinhanca',
  'aqui na regiao', 'na minha regiao', 'na minha area', 'na minha rua',
  'aqui na rua', 'no meu bairro', 'perto de mim', 'proximo de mim',
  'perto de casa', 'pertinho de casa', 'proximo daqui', 'perto daqui',
  'que atenda aqui', 'aqui do lado', 'aqui perto', 'por perto',
  'a domicilio', 'em domicilio', 'vem em casa', 'mais perto', 'vizinho'
];

const AVALIADO = [
  'que tenha boas avaliacoes', 'com otimas avaliacoes', 'com boa avaliacao',
  'mais bem avaliado', 'mais bem avaliada', 'melhor avaliado', 'melhor avaliada',
  'com boas notas', 'boa reputacao', 'bem recomendado', 'bem recomendada',
  'de confianca', 'que faz bem feito', 'trabalho bem feito', 'sem gambiarra',
  'sem enrolacao', 'cinco estrelas', '5 estrelas', 'nota alta', 'nota 5',
  'bem avaliado', 'bem avaliada', 'recomendado', 'recomendada', 'confiavel',
  'caprichoso', 'caprichado', 'honesto', 'responsavel', 'pontual',
  'o melhor', 'a melhor', 'os melhores'
];

const EXPERIENTE = [
  'com muitos servicos feitos', 'que ja fez muito servico',
  'com anos de experiencia', 'que trabalha ha anos', 'mao de obra qualificada',
  'que manje do assunto', 'que entenda do assunto', 'que saiba o que faz',
  'que faca direito', 'com experiencia', 'profissional mesmo',
  'que seja bom', 'especialista', 'qualificado', 'experiente', 'veterano'
];

const RESPOSTA = [
  'que responda rapido', 'que responde rapido', 'que atenda rapido',
  'que retorne rapido', 'sem me deixar no vacuo', 'que nao suma',
  'que responda mesmo', 'resposta rapida'
];

const PET = [
  'que nao se importe com cachorro', 'meu cachorro fica solto',
  'tenho cachorro em casa', 'casa com cachorro', 'com pet em casa',
  'tem pet em casa', 'tenho dois cachorros', 'que goste de animais',
  'que gosta de cachorro', 'amigo dos animais', 'que aceite pet',
  'tenho um cachorro', 'tenho um gato', 'tenho cachorro', 'tenho gato',
  'tenho animais', 'tenho bichos', 'tenho pet', 'pet friendly'
];

const MULHER = [
  'prefiro ser atendida por mulher', 'uma profissional mulher',
  'de preferencia mulher', 'profissional feminina', 'atendimento feminino',
  'prefiro uma senhora', 'prefiro uma moca', 'equipe feminina',
  'que seja mulher', 'mulher por favor', 'prefiro mulher', 'so mulheres',
  'so mulher'
];

const BARATO = [
  'que caiba no meu bolso', 'que caiba no bolso', 'que nao seja caro',
  'sem cobrar muito', 'sem cobrar caro', 'custo beneficio', 'com bom preco',
  'no meu orcamento', 'to sem grana', 'mais em conta', 'preco justo',
  'preco bom', 'mais barato', 'baratinho', 'economico', 'em conta', 'barato'
];

const ORCAMENTO = [
  'quero um orcamento', 'fazer um orcamento', 'pedir orcamento',
  'qual o preco de', 'qual o valor de', 'quanto cobra por', 'quanto custa',
  'quanto fica', 'quanto sai', 'quanto cobra', 'qual o preco', 'qual o valor',
  'orcamento de', 'orcamento para', 'orcamento', 'cotacao'
];

const VERIFICADO = [
  'profissional verificado', 'que tenha selo', 'com selo', 'verificado',
  'verificada', 'credenciado', 'certificado', 'com cnpj', 'registrado',
  'com nota fiscal'
];

const AGORA = [
  'que possa vir agora', 'que esteja disponivel', 'disponivel agora',
  'atendendo agora', 'que esteja livre', 'que esteja online', 'online agora',
  'de plantao agora'
];

/**
 * Bairros conhecidos — o atalho para nomes que aparecem sem preposicao. Bairro
 * fora da lista continua sendo pego por "no bairro X". ("portao" saiu: em nove
 * de cada dez frases e o portao que parou de abrir.)
 */
export const BAIRROS = [...new Set([
  'centro', 'moema', 'vila mariana', 'butanta', 'pinheiros', 'tijuca',
  'copacabana', 'ipanema', 'leblon', 'barreiro', 'savassi', 'boa viagem',
  'meier', 'santana', 'cabula', 'pituba', 'icarai', 'setor bueno',
  'asa norte', 'asa sul', 'bessa', 'manaira', 'jardins', 'lagoa',
  'campo grande', 'ipiranga', 'mooca', 'barra', 'barra da tijuca',
  'vila madalena', 'itaim bibi', 'morumbi', 'tatuape', 'santo amaro',
  'penha', 'lapa', 'perdizes', 'bela vista', 'liberdade', 'brooklin',
  'campo belo', 'vila olimpia', 'jabaquara', 'guarulhos', 'osasco',
  'botafogo', 'flamengo', 'laranjeiras', 'gavea', 'recreio', 'jacarepagua',
  'madureira', 'bangu', 'sao cristovao', 'vila isabel', 'grajau',
  'pampulha', 'buritis', 'lourdes', 'funcionarios', 'cidade nova',
  'aldeota', 'meireles', 'papicu', 'montese', 'parangaba', 'benfica',
  'casa forte', 'espinheiro', 'graças', 'gracas', 'boa vista', 'torre',
  'candeias', 'piedade', 'imbiribeira', 'rio vermelho', 'ondina',
  'itapua', 'stella maris', 'brotas', 'federacao', 'graca', 'canela',
  'moinhos de vento', 'cidade baixa', 'menino deus', 'petropolis',
  'bela vista', 'praia de belas', 'tristeza', 'ipanema porto alegre',
  'batel', 'agua verde', 'boqueirao', 'santa felicidade',
  'cabral', 'bigorrilho', 'juvevê', 'juveve', 'campina do siqueira',
  'adrianopolis', 'ponta negra', 'capim macio', 'tirol', 'petropolis natal',
  'jardim goias', 'setor oeste', 'setor sul', 'setor marista', 'vila nova',
  'jardim america', 'jardim paulista', 'vila nova conceicao', 'higienopolis',
  'consolacao', 'santa cecilia', 'bom retiro', 'belenzinho', 'vila prudente',
  'sacoma', 'saude', 'vila clementino', 'aclimacao', 'cambuci', 'bras',
  'agua branca', 'pompeia', 'sumare', 'alto de pinheiros', 'cidade jardim'
])];

export const CIDADES = [
  'sao paulo', 'rio de janeiro', 'belo horizonte', 'brasilia', 'salvador',
  'fortaleza', 'recife', 'porto alegre', 'curitiba', 'manaus', 'belem',
  'goiania', 'guarulhos', 'campinas', 'sao luis', 'maceio', 'natal',
  'teresina', 'campo grande', 'joao pessoa', 'jaboatao', 'santo andre',
  'osasco', 'sao bernardo do campo', 'uberlandia', 'sorocaba', 'ribeirao preto',
  'contagem', 'aracaju', 'feira de santana', 'cuiaba', 'joinville',
  'juiz de fora', 'londrina', 'aparecida de goiania', 'niteroi', 'ananindeua',
  'porto velho', 'serra', 'caxias do sul', 'vila velha', 'florianopolis',
  'macapa', 'sao jose dos campos', 'maua', 'sao jose do rio preto',
  'mogi das cruzes', 'diadema', 'betim', 'campina grande', 'olinda',
  'jundiai', 'carapicuiba', 'piracicaba', 'montes claros', 'bauru',
  'maringa', 'anapolis', 'vitoria', 'caruaru', 'blumenau', 'ponta grossa',
  'petrolina', 'canoas', 'franca', 'boa vista', 'uberaba', 'cascavel',
  'pelotas', 'praia grande', 'sao vicente', 'santos', 'taubate', 'limeira'
];

const contarPalavras = s => s.split(' ').length;
const porTamanhoDesc = lista =>
  lista.map((s, i) => [s, i]).sort((a, b) => (b[0].length - a[0].length) || (a[1] - b[1])).map(x => x[0]);

const BAIRROS_ORDENADOS = porTamanhoDesc(BAIRROS).map(b => [b, contarPalavras(b)]);
const CIDADES_ORDENADAS = porTamanhoDesc(CIDADES).map(c => [c, contarPalavras(c)]);

const TODOS = [
  [URGENCIA, 'URGENCIA'], [PERTO, 'PERTO'], [AVALIADO, 'AVALIADO'],
  [EXPERIENTE, 'EXPERIENTE'], [RESPOSTA, 'RESPOSTA'], [PET, 'PET'],
  [MULHER, 'MULHER'], [BARATO, 'BARATO'], [ORCAMENTO, 'ORCAMENTO'],
  [VERIFICADO, 'VERIFICADO'], [AGORA, 'AGORA']
];

/** Todos os marcadores numa lista so, do mais longo (em palavras) para o mais curto. */
const ORDENADOS = (() => {
  const vistos = new Set();
  const lista = [];
  for (const [termos, tipo] of TODOS) {
    for (const t of termos) {
      const n = Texto.norm(t);
      const chave = n + '\u0000' + tipo;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      lista.push({ termo: n, alvo: n.split(' '), tam: contarPalavras(n), tipo, ordem: lista.length });
    }
  }
  return lista.sort((a, b) => (b.tam - a.tam) || (a.ordem - b.ordem));
})();

const RE_KM = /(\d{1,3})\s*(?:km|quilometros?|quilometro)/;
const RE_REAIS = /(?:ate|no maximo|max|maximo)\s+(\d{1,6})(?:\s*(?:reais|real|conto|contos|pila|pilas|mangos|paus))?/;
const RE_BAIRRO = /(?:bairro|regiao|zona)\s+(?:de\s+|da\s+|do\s+)?([a-z]+(?:\s+[a-z]+)?)/;

// ------------------------------------------------------------ entrada

/**
 * Le a frase e devolve a intencao.
 * @param {string} frase
 * @param {import('./vocabulario.js').Vocabulario|null} vocab
 * @returns {IntencaoBusca}
 */
export function interpretar(frase, vocab) {
  frase = frase == null ? '' : String(frase);
  const palavras = Texto.palavras(frase);
  if (palavras.length === 0) return new IntencaoBusca({ frase });
  const usadas = new Array(palavras.length).fill(false);

  let urgente = false;
  let raio = null;
  let ordem = Ordem.RELEVANCIA;
  let bairro = null;
  let cidade = null;
  let pet = false;
  let mulher = false;
  let verificado = false;
  let agora = false;
  let precoMax = null;
  let orcamento = false;

  // 1. marcadores, do mais longo para o mais curto
  for (const m of ORDENADOS) {
    const onde = acharSpan(palavras, usadas, m.alvo);
    if (onde < 0) continue;
    for (let i = onde; i < onde + m.tam; i++) usadas[i] = true;
    switch (m.tipo) {
      case 'URGENCIA': urgente = true; break;
      case 'PERTO': if (raio == null) raio = 5; break;
      case 'AVALIADO': if (ordem === Ordem.RELEVANCIA) ordem = Ordem.AVALIACAO; break;
      case 'EXPERIENTE': if (ordem === Ordem.RELEVANCIA) ordem = Ordem.SERVICOS; break;
      case 'RESPOSTA': ordem = Ordem.RESPOSTA; break;
      case 'PET': pet = true; break;
      case 'MULHER': mulher = true; break;
      case 'BARATO': if (ordem === Ordem.RELEVANCIA) ordem = Ordem.PRECO; break;
      case 'ORCAMENTO': orcamento = true; break;
      case 'VERIFICADO': verificado = true; break;
      case 'AGORA': agora = true; break;
    }
  }

  // 2. numeros: raio em km e teto de preco
  const sobrando = naoUsadas(palavras, usadas).join(' ');
  const mKm = RE_KM.exec(sobrando);
  if (mKm) {
    const v = parseInt(mKm[1], 10);
    raio = Number.isNaN(v) ? null : Math.min(200, Math.max(1, v));
    marcarSpan(palavras, usadas, Texto.palavras(mKm[0]));
  }
  const mReais = RE_REAIS.exec(sobrando);
  if (mReais) {
    const v = parseFloat(mReais[1]);
    precoMax = Number.isNaN(v) ? null : v;
    marcarSpan(palavras, usadas, Texto.palavras(mReais[0]));
  }

  // 3. o bairro dito por extenso ("no bairro Moema")
  const mBairro = RE_BAIRRO.exec(naoUsadas(palavras, usadas).join(' '));
  if (mBairro) {
    bairro = mBairro[1].trim();
    marcarSpan(palavras, usadas, Texto.palavras(mBairro[0]));
  }

  // O titulo: tudo que os marcadores nao levaram, ainda com as preposicoes.
  const paraTitulo = naoUsadas(palavras, usadas).join(' ');

  // 4. a categoria, no que sobrou (antes da lista de bairros, de proposito).
  const restantes = naoUsadas(palavras, usadas);
  let acertos = vocab ? vocab.acertos(restantes) : [];

  // Marcador que era a unica pista de servico ("quero socorro 24 horas").
  if (acertos.length === 0 && vocab && restantes.length < palavras.length) {
    acertos = vocab.acertos(palavras);
  }

  const pontosIns = new Map();
  for (const a of acertos) {
    const bonus = 1 + a.palavrasCobertas;
    for (const p of a.pesos) {
      const valor = a.exato ? p.peso * bonus : Math.trunc(p.peso * bonus * 7 / 10);
      pontosIns.set(p.categoria, (pontosIns.get(p.categoria) || 0) + valor);
    }
  }
  // Ordem de iteracao do HashMap<Int, Int>() do Kotlin: decide os empates.
  const entradas = ordenarComoJava(Array.from(pontosIns.entries()), e => hashInt(e[0]), 16);
  const pontos = new Map(entradas);

  let categoriaId = null;
  let candidatas = [];
  let ehPalpite = false;
  const exata = acertos.some(a => a.exato && a.pesos.length > 0);
  if (entradas.length > 0) {
    let maximo = -Infinity;
    for (const [, v] of entradas) if (v > maximo) maximo = v;
    // Prova fraca nao decide sozinha.
    const provaFraca = maximo < PONTOS_CONFIAVEIS;
    const corte = provaFraca ? Math.trunc(maximo * 2 / 5) : Math.trunc(maximo * 3 / 5);
    const topo = entradas.filter(e => e[1] >= corte).sort((a, b) => b[1] - a[1]).map(e => e[0]);
    if (topo.length > 1) {
      // Empatou: pergunta. Palpites e o resto pontuado completam a folha.
      const extras = vocab ? vocab.palpites(palavras, 3, 4) : [];
      const restoPontuado = entradas.slice().sort((a, b) => b[1] - a[1]).map(e => e[0]);
      candidatas = distintos([...topo, ...extras, ...restoPontuado]).slice(0, 8);
    } else if (!provaFraca) {
      categoriaId = topo[0];
    } else {
      // Lider sozinho, mas com prova fraca: completa com os proximos parecidos.
      const extras = vocab ? vocab.palpites(palavras, 3) : [];
      const juntos = distintos([...topo, ...extras]).slice(0, 4);
      if (juntos.length > 1) candidatas = juntos; else categoriaId = topo[0];
    }
  } else if (vocab) {
    // Nada casou: oferece os palpites mais proximos em vez de "nao entendi".
    candidatas = vocab.palpites(palavras);
    ehPalpite = candidatas.length > 0;
  }

  // 5. o lugar, no que a categoria nao levou
  const consumidas = new Set();
  for (const a of acertos) for (const p of Texto.palavras(a.termo)) consumidas.add(p);
  for (let i = 0; i < palavras.length; i++) {
    if (!usadas[i] && consumidas.has(palavras[i])) usadas[i] = true;
  }
  if (bairro == null) {
    for (const [b, tam] of BAIRROS_ORDENADOS) {
      const onde = acharSpan(palavras, usadas, b.split(' '), tam);
      if (onde < 0) continue;
      for (let i = onde; i < onde + tam; i++) usadas[i] = true;
      bairro = b;
      break;
    }
  }
  for (const [c, tam] of CIDADES_ORDENADAS) {
    const onde = acharSpan(palavras, usadas, c.split(' '), tam);
    if (onde < 0) continue;
    for (let i = onde; i < onde + tam; i++) usadas[i] = true;
    cidade = c;
    break;
  }

  // 6. o que sobrou vira busca por texto, nao lixo
  const livre = palavras.filter((p, i) => !usadas[i] && !Texto.VAZIAS.has(p)).join(' ');

  const etqs = [];
  const nome = categoriaId != null && vocab ? vocab.categoria(categoriaId) : null;
  if (nome) etqs.push({ campo: Campo.CATEGORIA, emoji: nome.emoji, rotulo: nome.nome });
  if (urgente) etqs.push({ campo: Campo.URGENCIA, emoji: '⚡', rotulo: 'Urgente' });
  if (raio != null) etqs.push({ campo: Campo.RAIO, emoji: '📍', rotulo: `Até ${raio} km` });
  if (ordem !== Ordem.RELEVANCIA) {
    etqs.push({ campo: Campo.ORDEM, emoji: EMOJI_ORDEM[ordem], rotulo: ROTULO_ORDEM[ordem] });
  }
  if (bairro != null) etqs.push({ campo: Campo.BAIRRO, emoji: '🏘', rotulo: capitalizar(bairro) });
  if (cidade != null) etqs.push({ campo: Campo.CIDADE, emoji: '🗺', rotulo: capitalizar(cidade) });
  if (pet) etqs.push({ campo: Campo.PET, emoji: '🐾', rotulo: 'Pet friendly' });
  if (mulher) etqs.push({ campo: Campo.MULHER, emoji: '♀', rotulo: 'Só mulheres' });
  if (verificado) etqs.push({ campo: Campo.VERIFICADO, emoji: '✅', rotulo: 'Documento conferido' });
  if (agora) etqs.push({ campo: Campo.AGORA, emoji: '🟢', rotulo: 'Atendendo agora' });
  if (precoMax != null) etqs.push({ campo: Campo.PRECO, emoji: '💰', rotulo: `Até R$ ${Math.trunc(precoMax)}` });
  if (livre.trim() !== '') etqs.push({ campo: Campo.TEXTO, emoji: '', rotulo: '"' + livre + '"' });

  const titulo = paraTitulo.trim();
  return new IntencaoBusca({
    frase,
    categoriaId,
    candidatas,
    palpite: ehPalpite,
    pontos,
    urgente,
    raioKm: raio,
    ordem,
    bairro,
    cidade,
    petFriendly: pet,
    soMulheres: mulher,
    soVerificados: verificado,
    soDisponiveis: agora,
    precoMax,
    querOrcamento: orcamento,
    textoLivre: livre,
    leituraExata: exata,
    tituloSugerido: titulo ? titulo[0].toUpperCase() + titulo.slice(1) : '',
    etiquetas: etqs
  });
}

function naoUsadas(palavras, usadas) {
  const r = [];
  for (let i = 0; i < palavras.length; i++) if (!usadas[i]) r.push(palavras[i]);
  return r;
}

function distintos(lista) {
  return [...new Set(lista)];
}

function capitalizar(s) {
  return s.split(' ').map(p => (p.length <= 2 ? p : p[0].toUpperCase() + p.slice(1))).join(' ');
}

/** Onde comeca a sequencia `alvo` entre palavras ainda nao usadas? -1 se nao achou. */
function acharSpan(palavras, usadas, alvo, tamanho = alvo.length) {
  if (alvo.length !== tamanho) return -1;
  externo:
  for (let i = 0; i <= palavras.length - tamanho; i++) {
    for (let j = 0; j < tamanho; j++) {
      if (usadas[i + j] || palavras[i + j] !== alvo[j]) continue externo;
    }
    return i;
  }
  return -1;
}

function marcarSpan(palavras, usadas, alvo) {
  if (alvo.length === 0) return;
  const onde = acharSpan(palavras, usadas, alvo);
  if (onde < 0) return;
  for (let i = onde; i < onde + alvo.length; i++) usadas[i] = true;
}

// ------------------------------------------------------------ voz

/**
 * O reconhecedor de voz devolve varias transcricoes; fica a que rende mais
 * informacao util (porte de MelhorAlternativa.escolher).
 * @param {string[]} transcricoes
 * @param {import('./vocabulario.js').Vocabulario|null} vocab
 * @returns {string}
 */
export function melhorAlternativa(transcricoes, vocab) {
  const validas = (transcricoes || []).filter(s => s != null && String(s).trim() !== '');
  if (validas.length === 0) return '';
  if (validas.length === 1) return validas[0];
  let melhor = null;
  let melhorNota = -Infinity;
  for (const frase of validas) {
    const i = interpretar(frase, vocab);
    let nota = 0;
    if (i.categoriaId != null) nota += 10;
    else if (i.candidatas.length > 0) nota += 4;
    if (i.leituraExata) nota += 6;
    nota += i.etiquetas.length;
    if (i.bairro != null) nota += 2;
    if (i.textoLivre.trim() !== '') nota += 1;
    const total = nota * 100 - validas.indexOf(frase);
    if (total > melhorNota) { melhorNota = total; melhor = frase; }
  }
  return melhor != null ? melhor : validas[0];
}
