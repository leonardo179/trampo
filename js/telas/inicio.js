import { h, icone, toast, atrasar, aoAparecer, esqueletos, vazio } from '../ui.js';
import { categorias, categoriaSinc, cartaoPrestador } from '../componentes.js';
import * as M from '../motor.js';
import { cartaoPosContato } from '../posContato.js';

// As oito mais pedidas, com rótulo curto escrito à mão (igual à GradeCategorias do app).
const MAIS_PEDIDAS = [[1, 'Eletricista'], [2, 'Encanador'], [5, 'Diarista'], [3, 'Pintor'], [8, 'Montador'], [11, 'Ar-cond.'], [21, 'Cabelo'], [28, 'Informática']];
const EXEMPLOS = ['minha pia entupiu', 'tenho cachorro em casa, preciso de diarista', 'pc lentíssimo', 'vazamento urgente', 'chuveiro não esquenta', 'ar condicionado pingando água'];
const POR_PAGINA = 20;

// Estado guardado entre visitas: voltar de um perfil não refaz a busca nem perde a rolagem.
const S = { frase: '', intencao: null, catDireta: null, filtros: new Set(), ordem: 'relevancia', geo: null };

export default async function inicio({ D, params, ir }) {
  const u = D.estado.usuario;
  const qUrl = params.get('q'), cUrl = params.get('c');
  if (qUrl != null && qUrl !== S.frase) { S.frase = qUrl; S.intencao = null; S.catDireta = null; }
  if (cUrl) { S.catDireta = +cUrl; S.frase = ''; S.intencao = null; }
  if (!qUrl && !cUrl && params.toString() === '') { S.frase = ''; S.intencao = null; S.catDireta = null; }

  await categorias();
  const base = D.prestadores();

  // ---------------------------------------------------------------- cabeçalho com o campo de frase
  const input = h('input', {
    type: 'search', value: S.frase, enterkeyhint: 'search', autocomplete: 'off', spellcheck: false,
    placeholder: 'Escreva o problema: "minha pia entupiu"', 'aria-label': 'Do que você precisa?'
  });
  const botaoAcao = h('button.acao', { type: 'submit' });
  const limpar = h('button.limpar', { type: 'button', 'aria-label': 'Limpar', onclick: () => { input.value = ''; mudouTexto(true); input.focus(); } }, icone('x', 'p'));
  const previa = h('div.previa');
  const temVoz = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  function pintarBotao() {
    const vazio_ = !input.value.trim();
    limpar.hidden = vazio_;
    botaoAcao.replaceChildren(icone(vazio_ && temVoz ? 'mic' : vazio_ ? 'lupa' : 'seta_cima'));
    botaoAcao.setAttribute('aria-label', vazio_ && temVoz ? 'Falar' : 'Buscar');
  }

  const form = h('form.campo-frase', {
    role: 'search',
    onsubmit: e => {
      e.preventDefault();
      if (!input.value.trim()) { if (temVoz) ouvir(); else input.focus(); return; }
      input.blur();
      confirmarBusca();
    }
  }, icone('lupa', 'p'), input, limpar, botaoAcao);

  const primeiroNome = (u.nome || '').split(' ')[0];
  const cab = h('header.cabecalho',
    h('div.sobre', D.estado.visitante ? 'Olá, visitante' : `Olá, ${primeiroNome}`),
    h('h1', 'Do que você precisa hoje?'),
    h('div.recado', 'Escreva do seu jeito. O Trampo entende o problema e acha quem resolve.'),
    form, previa);

  // ---------------------------------------------------------------- corpo
  const corpo = h('div');
  const pos = D.estado.visitante ? null : cartaoPosContato(D);
  const el = h('div', cab,
    D.estado.visitante ? h('div.faixa-visitante', icone('info', 'p'),
      h('span', 'Primeira vez aqui? ', h('a', { href: '#/sobre', style: { color: 'inherit', textDecoration: 'underline' } }, 'Conheça o Trampo')),
      h('button.botao', { onclick: () => ir('/entrar?modo=cadastro') }, 'Criar conta')) : null,
    corpo);

  // ---------------------------------------------------------------- voz
  let reconhecendo = null;
  function ouvir() {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (reconhecendo) { reconhecendo.stop(); return; }
    const r = new R();
    r.lang = 'pt-BR'; r.maxAlternatives = 5; r.interimResults = false;
    reconhecendo = r; botaoAcao.classList.add('ouvindo');
    r.onresult = e => {
      const alts = [...e.results[0]].map(a => a.transcript);
      input.value = M.pronto() ? M.melhorAlternativa(alts) : alts[0];
      mudouTexto(true); confirmarBusca();
    };
    r.onerror = e => { if (e.error !== 'aborted' && e.error !== 'no-speech') toast('Não consegui ouvir. Tente digitar.', 'erro'); };
    r.onend = () => { reconhecendo = null; botaoAcao.classList.remove('ouvindo'); };
    r.start();
  }

  // ---------------------------------------------------------------- busca
  function interpretarAgora() {
    S.frase = input.value;
    S.intencao = S.frase.trim() && M.pronto() ? M.interpretar(S.frase) : null;
  }
  const previaAtrasada = atrasar(() => { interpretarAgora(); pintarPrevia(); if (S.frase.trim()) desenhar(); }, 250);
  function mudouTexto(imediato = false) {
    pintarBotao();
    if (!input.value.trim()) { S.frase = ''; S.intencao = null; pintarPrevia(); desenhar(); return; }
    S.catDireta = null;
    if (imediato) { interpretarAgora(); pintarPrevia(); desenhar(); } else previaAtrasada();
  }
  input.addEventListener('input', () => mudouTexto());
  function confirmarBusca() {
    interpretarAgora(); pintarPrevia(); desenhar();
    history.replaceState(null, '', '#/?q=' + encodeURIComponent(S.frase));
  }

  function pintarPrevia() {
    previa.replaceChildren();
    if (!S.frase.trim()) return;
    if (!M.pronto()) { previa.append(h('span', 'Preparando a busca inteligente…')); return; }
    const et = M.etiquetas(S.intencao);
    if (!et.length) return;
    previa.append(h('span', 'Entendi:'), ...et.map(e => h('span.pilula', e.rotulo)));
  }

  // ---------------------------------------------------------------- telas do corpo
  function desenhar() {
    if (S.catDireta || S.frase.trim()) desenharResultados();
    else desenharVitrine();
  }

  function desenharVitrine() {
    const grade = h('div.grade-cat', MAIS_PEDIDAS.map(([id, rot]) => {
      const c = categoriaSinc(id);
      return h('a.cat', { href: `#/?c=${id}` }, h('span.emo', c.e), h('span.rot', rot));
    }));
    const destaques = h('div', esqueletos(4));
    corpo.replaceChildren(
      pos ? h('section.secao', { style: { paddingBottom: 0 } }, pos.el) : '',
      h('section.secao',
        h('div.lista.grade-2',
          h('button.cartao', {
            style: { display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', background: 'color-mix(in srgb, var(--urgente) 12%, var(--superficie))' },
            onclick: () => { S.filtros = new Set(['24h']); input.value = 'urgente'; mudouTexto(true); confirmarBusca(); }
          }, h('span', { style: { color: 'var(--urgente)' } }, icone('raio')), h('span', h('b', 'Estou com pressa'), h('br'), h('small', { style: { color: 'var(--texto-2)' } }, 'Quem atende urgência 24 h'))),
          h('a.cartao', {
            href: '#/publicar',
            style: { display: 'flex', alignItems: 'center', gap: '12px', color: 'inherit', background: 'color-mix(in srgb, var(--violeta) 10%, var(--superficie))' }
          }, h('span', { style: { color: 'var(--violeta)' } }, icone('mural')), h('span', h('b', 'Publicar pedido'), h('br'), h('small', { style: { color: 'var(--texto-2)' } }, 'Profissionais vêm até você'))))),
      h('section.secao',
        h('div.secao-titulo', h('h2', 'Mais procurados'), h('a.mais', { href: '#/categorias' }, 'Ver todas as 110')),
        grade),
      h('section.secao',
        h('div.secao-titulo', h('h2', 'Experimente escrever')),
        h('div.atalhos', EXEMPLOS.map(t => h('button.chip', { onclick: () => { input.value = t; mudouTexto(true); confirmarBusca(); } }, `“${t}”`)))),
      h('section.secao',
        h('div.secao-titulo', h('h2', u.cidade ? `Bem avaliados em ${u.cidade}` : 'Bem avaliados'), h('span.conta')),
        destaques),
      h('section.secao',
        h('div.cartao',
          h('div', { style: { fontWeight: 750, marginBottom: '8px' } }, 'O combinado do Trampo'),
          [['🆓', 'Ver e falar com um profissional é de graça. Sempre.'],
           ['🚫', 'Não vendemos moedas nem cobramos por contato liberado.'],
           ['🤝', 'Preço e prazo são combinados direto entre vocês dois.'],
           ['💬', 'Mostramos quantos clientes cada profissional respondeu de verdade.']]
            .map(([e, t]) => h('div', { style: { display: 'flex', gap: '10px', padding: '4px 0', fontSize: '14px', color: 'var(--texto-2)' } }, h('span', e), t)))));

    base.then(lista => {
      const top = M.destaques(lista, u, 6);
      destaques.replaceChildren(h('div.lista.grade-2', top.map(r => cartaoPrestador(D, r.prestador, { distancia: r.distanciaKm }))));
    }).catch(e => destaques.replaceChildren(vazio('📡', 'Não consegui carregar', D.mensagemDeErro(e), h('button.botao', { onclick: () => location.reload() }, 'Tentar de novo'))));
  }

  const FILTROS = [['agora', 'Atende agora'], ['24h', 'Urgência 24h'], ['verificado', 'Verificado'], ['preco', 'Com preço'], ['pet', 'Aceita pet']];
  const ORDENS = [['relevancia', 'Mais indicados'], ['nota', 'Melhor nota'], ['perto', 'Mais perto'], ['resposta', 'Responde mais']];

  function desenharResultados() {
    const intencao = S.intencao;
    const topo = h('div');
    const lista = h('div');
    corpo.replaceChildren(h('section.secao', topo, lista));

    // Etiquetas com "x" — recalculadas da intenção, nunca editadas à mão.
    const etiquetas = intencao ? M.etiquetas(intencao) : [];
    const linhaEt = h('div.atalhos');
    if (S.catDireta) {
      const c = categoriaSinc(S.catDireta);
      linhaEt.append(h('span.chip.etiqueta', `${c.e} ${c.nome}`, h('button.x', { 'aria-label': 'Tirar', onclick: () => ir('/') }, icone('x', 'pp'))));
    }
    for (const e of etiquetas) {
      linhaEt.append(h('span.chip.etiqueta', e.rotulo, h('button.x', {
        'aria-label': 'Tirar ' + e.rotulo, onclick: () => { S.intencao = M.sem(S.intencao, e.campo); pintarPreviaDe(); desenharResultados(); }
      }, icone('x', 'pp'))));
    }
    const linhaFiltros = h('div.atalhos', { style: { marginTop: '8px' } },
      FILTROS.map(([id, rot]) => h('button.chip', {
        'aria-pressed': String(S.filtros.has(id)),
        onclick: () => { S.filtros.has(id) ? S.filtros.delete(id) : S.filtros.add(id); desenharResultados(); }
      }, rot)),
      h('span', { style: { width: '1px', background: 'var(--linha)', margin: '4px 2px', flex: 'none' } }),
      ORDENS.map(([id, rot]) => h('button.chip', {
        'aria-pressed': String(S.ordem === id),
        onclick: async () => {
          if (id === 'perto' && !S.geo && !(u.lat != null)) await pedirLocalizacao();
          S.ordem = id; desenharResultados();
        }
      }, id === 'perto' ? icone('local', 'pp') : null, rot)));
    topo.append(linhaEt.childNodes.length ? linhaEt : '', linhaFiltros);

    // Ambiguidade: mais de uma categoria reivindica o termo → a pessoa escolhe. Nunca chuta.
    const cands = intencao ? M.candidatas(intencao) : [];
    if (cands.length > 1) {
      lista.replaceChildren(h('div.cartao', { style: { marginTop: '12px' } },
        h('div', { style: { fontWeight: 750, marginBottom: '4px' } }, `“${M.termoAmbiguo(intencao) || S.frase}” pode ser mais de uma coisa`),
        h('div', { style: { color: 'var(--texto-2)', fontSize: '14px', marginBottom: '12px' } }, 'Qual destas você procura?'),
        h('div.opcoes', cands.map(c => h('button.opcao', {
          onclick: () => { S.intencao = M.escolherCategoria(intencao, c.id); pintarPreviaDe(); desenharResultados(); }
        }, h('span.emo', categoriaSinc(c.id).e), categoriaSinc(c.id).nome)))));
      return;
    }

    lista.replaceChildren(h('div', { style: { marginTop: '12px' } }, esqueletos(4)));
    base.then(todos => {
      const geo = S.geo || (u.lat != null ? { lat: u.lat, lng: u.lng } : null);
      let res = S.catDireta
        ? M.porCategoria(todos, S.catDireta, { usuario: u, geo })
        : M.aplicar(todos, intencao, S.frase, { usuario: u, geo });
      res = M.filtrarExtras(res, S.filtros);
      res = M.ordenar(res, S.ordem);
      pintarLista(lista, res, intencao);
    }).catch(e => lista.replaceChildren(vazio('📡', 'Não consegui carregar', D.mensagemDeErro(e))));
  }

  function pintarPreviaDe() {
    previa.replaceChildren();
    const et = S.intencao ? M.etiquetas(S.intencao) : [];
    if (et.length) previa.append(h('span', 'Entendi:'), ...et.map(e => h('span.pilula', e.rotulo)));
  }

  function pintarLista(lista, res, intencao) {
    const semServico = intencao && !M.temCategoria(intencao) && S.frase.trim();
    const cab = h('div.secao-titulo', { style: { marginTop: '16px' } },
      h('h2', res.length ? `${res.length} profissiona${res.length === 1 ? 'l' : 'is'}` : 'Nenhum profissional'),
      h('span.conta', S.ordem === 'relevancia' ? 'resposta, nota e distância' : ''));
    const aviso = semServico && M.pronto()
      ? h('div.honesto', { style: { marginBottom: '12px' } }, h('span', '🔎'),
        h('div', h('b', 'Não reconheci um serviço nessa frase'), `Busquei pelo texto de “${S.frase.trim()}”. Toque numa categoria se quiser ser mais específico.`))
      : res.foraDoBairro && res.length
        ? h('div.honesto', { style: { marginBottom: '12px' } }, h('span', '📍'),
          h('div', h('b', `Ninguém desse serviço em ${res.foraDoBairro} ainda`), 'Mostrando quem atende nos outros bairros.'))
      : res.foraDaCidade && res.length && u.cidade
        ? h('div.honesto', { style: { marginBottom: '12px' } }, h('span', '📍'),
          h('div', h('b', `Ninguém em ${u.cidade} ainda`), 'Mostrando profissionais de outras cidades que atendem esse serviço.'))
        : null;
    if (!res.length) {
      lista.replaceChildren(cab, aviso || '', vazio('🧐', 'Ninguém com esses filtros', 'Tire alguma etiqueta acima ou publique um pedido — quem atende vai até você.',
        h('a.botao', { href: '#/publicar' + (intencao && M.temCategoria(intencao) ? '?c=' + M.categoriaDe(intencao) : '') }, icone('mural', 'p'), 'Publicar pedido')));
      return;
    }
    const grade = h('div.lista.grade-2');
    const mais = h('div.mais-carregar');
    let mostrados = 0;
    const pagina = () => {
      const fatia = res.slice(mostrados, mostrados + POR_PAGINA);
      grade.append(...fatia.map(r => cartaoPrestador(D, r.prestador, { distancia: r.distanciaKm })));
      mostrados += fatia.length;
      mais.replaceChildren();
      if (mostrados < res.length) {
        const sentinela = h('div', { style: { height: '1px' } });
        mais.append(sentinela);
        aoAparecer(sentinela, pagina);
      }
    };
    pagina();
    lista.replaceChildren(cab, aviso || '', grade, mais);
  }

  async function pedirLocalizacao() {
    if (!navigator.geolocation) return;
    await new Promise(res => navigator.geolocation.getCurrentPosition(
      p => { S.geo = { lat: p.coords.latitude, lng: p.coords.longitude }; res(); },
      () => { toast('Sem a localização, ordeno pelo seu bairro e cidade.'); res(); },
      { timeout: 8000, maximumAge: 600000 }));
  }

  // O vocabulário pode ainda estar chegando: assim que ficar pronto, a busca pendente é refeita.
  pintarBotao();
  if (!M.pronto()) {
    M.preparar().then(() => {
      if (!el.isConnected) return;
      if (S.frase.trim()) { interpretarAgora(); pintarPrevia(); desenhar(); }
    }).catch(() => {});
  } else if (S.frase.trim() && !S.intencao) interpretarAgora();
  pintarPrevia();
  desenhar();

  return { el, titulo: S.frase ? S.frase : '', limpar: () => pos?.parar() };
}
