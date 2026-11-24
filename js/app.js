// Casca do app: rotas por hash, navegação (barra embaixo no celular, lateral no PC) e sessão.
import { h, icone, toast, logo } from './ui.js';

const app = document.getElementById('app');
let D; // módulo de dados (Firebase), carregado em paralelo com a primeira pintura

const ROTAS = [
  [/^\/?$/, 'inicio', 'inicio'],
  [/^\/categorias$/, 'categorias', 'inicio'],
  [/^\/p\/([\w-]+)$/, 'prestador', 'inicio'],
  [/^\/mural$/, 'mural', 'mural'],
  [/^\/publicar$/, 'publicar', 'mural'],
  [/^\/pedido\/([\w-]+)$/, 'pedido', 'mural'],
  [/^\/conversas$/, 'conversas', 'conversas'],
  [/^\/conversa\/([\w-]+)$/, 'chat', 'conversas'],
  [/^\/favoritos$/, 'favoritos', 'favoritos'],
  [/^\/perfil$/, 'perfil', 'perfil'],
  [/^\/entrar$/, 'acesso', null],
  [/^\/sobre$/, 'sobre', 'sobre'],
  [/^\/profissional$/, 'profissional', 'perfil'],
  [/^\/avaliar\/([\w-]+)$/, 'avaliar', 'inicio'],
];
const ABAS = [
  ['inicio', '#/', 'casa', 'Início'],
  ['mural', '#/mural', 'mural', 'Mural'],
  ['conversas', '#/conversas', 'chat', 'Conversas'],
  ['favoritos', '#/favoritos', 'coracao', 'Favoritos'],
  ['perfil', '#/perfil', 'usuario', 'Perfil'],
];

const modulos = {};
const carregar = nome => modulos[nome] ||= import(`./telas/${nome}.js`);

let shell, conteudo, nav, limparTela = null, rotaAtual = '';
const rolagens = new Map();

function montarShell() {
  conteudo = h('main.conteudo#conteudo', { tabindex: '-1' });
  nav = h('nav.nav', { 'aria-label': 'Navegação principal' },
    h('a.nav-marca', { href: '#/' }, logo(36), 'Trampo'),
    ABAS.map(([id, href, ic, rot]) =>
      h('a.nav-item', { href, 'data-aba': id }, h('span.bolha', icone(ic)), h('span', rot), h('span.ponto', { hidden: true }))),
    h('div.nav-rodape',
      h('div.nav-conta'),
      h('a.nav-sobre', { href: '#/sobre' }, h('span.logo-mini', icone('escudo', 'pp')), 'Conheça o Trampo'),
      h('p', 'Contato grátis, sem moeda e sem taxa. Preço e prazo combinados direto com o profissional.'),
      h('div.links-legais', h('a', { href: 'termos.html' }, 'Termos'), ' · ', h('a', { href: 'privacidade.html' }, 'Privacidade'))));
  shell = h('div.shell', nav, conteudo);
  pintarConta();
}

function lerHash() {
  const bruto = location.hash.replace(/^#/, '') || '/';
  const [caminho, qs = ''] = bruto.split('?');
  return { caminho, params: new URLSearchParams(qs), bruto };
}

export function ir(destino, { substituir = false } = {}) {
  const novo = '#' + destino;
  if (substituir) { history.replaceState(null, '', novo); rotear(); }
  else if (location.hash === novo) rotear(); else location.hash = destino;
}
let navegacoes = 0;
export function voltar(padrao = '/') {
  // Quem chegou por um link direto não tem "atrás" dentro do app: volta para a aba.
  if (navegacoes > 1) history.back(); else ir(padrao, { substituir: true });
}

async function rotear() {
  const { caminho, params, bruto } = lerHash();
  if (rotaAtual) rolagens.set(rotaAtual, window.scrollY);
  rotaAtual = bruto;
  navegacoes++;

  let alvo = ROTAS.find(([re]) => re.test(caminho));
  if (!alvo) { ir('/', { substituir: true }); return; }
  const [re, nome, aba] = alvo;
  const args = caminho.match(re).slice(1);

  const est = D?.estado;
  // Quem chega sem conta entra direto na vitrine, como visitante (sessão anônima: as regras do
  // Firestore pedem login para ler). A conta só é pedida na hora de chamar, salvar ou publicar.
  if (!est?.usuario && nome !== 'acesso') {
    try { await D.entrarComoVisitante(); }
    catch { ir('/entrar', { substituir: true }); return; }
    if (rotaAtual !== bruto) return;
  }
  if (nome === 'acesso' && est?.usuario && !est.visitante) { ir('/', { substituir: true }); return; }

  limparTela?.(); limparTela = null;
  const mod = await carregar(nome);
  if (rotaAtual !== bruto) return; // usuário já navegou para outro lugar

  if (aba === null) {
    app.replaceChildren();
    const tela = await mod.default({ args, params, ir, D });
    app.replaceChildren(tela.el || tela);
    limparTela = tela.limpar || null;
    window.scrollTo(0, 0);
    return;
  }
  if (!shell) montarShell();
  if (shell.parentNode !== app) app.replaceChildren(shell);
  for (const a of nav.querySelectorAll('.nav-item')) {
    if (a.dataset.aba === aba) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const tela = await mod.default({ args, params, ir, D });
  if (rotaAtual !== bruto) { tela.limpar?.(); return; }
  const pagina = h('div.pagina', tela.el || tela);
  conteudo.replaceChildren(pagina);
  limparTela = tela.limpar || null;
  const y = rolagens.get(bruto);
  requestAnimationFrame(() => window.scrollTo(0, voltandoAtras && y ? y : 0));
  voltandoAtras = false;
  document.title = (tela.titulo ? tela.titulo + ' · ' : '') + 'Trampo';
}

let voltandoAtras = false;
window.addEventListener('popstate', () => { voltandoAtras = true; });
window.addEventListener('hashchange', rotear);

/** Contador de não lidas na aba Conversas. */
let pararConversas = null;
/** Menu lateral (PC): visitante vê "Entrar" e "Criar conta"; logado vê quem está na conta. */
function pintarConta() {
  if (!nav) return;
  const alvo = nav.querySelector('.nav-conta'); if (!alvo) return;
  const est = D?.estado;
  alvo.replaceChildren(...(!est?.usuario ? [] : est.visitante
    ? [h('a.botao.peq.largo', { href: '#/entrar?modo=cadastro' }, 'Criar conta grátis'), h('a.botao.peq.sec.largo', { href: '#/entrar' }, 'Entrar')]
    : [h('a.nav-quem', { href: '#/perfil' }, h('b', (est.usuario.nome || '').split(' ')[0]), h('span', est.usuario.email || ''))]));
}

function ligarContadores() {
  pintarConta();
  pararConversas?.(); pararConversas = null;
  if (!D.estado.usuario || D.estado.visitante) return;
  pararConversas = D.ouvirConversas(lista => {
    const eu = D.uid();
    const n = lista.reduce((s, c) => s + ((c.prestadorId === eu ? c.naoLidasPrestador : c.naoLidasCliente) || 0), 0);
    if (!nav) montarShell();
    const ponto = nav.querySelector('[data-aba="conversas"] .ponto');
    ponto.hidden = !n; ponto.textContent = n > 9 ? '9+' : n;
  });
}

async function iniciar() {
  try {
    D = await import('./dados.js');
  } catch (e) {
    app.replaceChildren(h('div.vazio', { style: { paddingTop: '30vh' } },
      h('div.emo', '📡'), h('h3', 'Não consegui conectar'), h('p', 'Confira sua internet e tente de novo.'),
      h('button.botao', { onclick: () => location.reload() }, 'Tentar de novo')));
    return;
  }
  await D.sessaoPronta;
  let quem = D.estado.usuario?.id;
  D.aoMudar(est => {
    if (est.usuario?.id !== quem) {
      quem = est.usuario?.id;
      ligarContadores();
      // Saiu da conta: volta para a vitrine (como visitante) com a navegação redesenhada.
      if (!est.usuario) { shell = null; ir('/', { substituir: true }); }
    }
  });
  ligarContadores();
  // Deixa o vocabulário da busca (4,8 MB) baixando enquanto a pessoa olha a primeira tela.
  import('./motor.js').then(m => m.preparar()).catch(() => {});
  rotear();
}

window.addEventListener('unhandledrejection', e => {
  console.error(e.reason);
  if (D) toast(D.mensagemDeErro(e.reason), 'erro');
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

iniciar();
