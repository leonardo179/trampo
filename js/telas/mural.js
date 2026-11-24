import { h, icone, tempoAtras, reais, esqueletos, vazio } from '../ui.js';
import { categorias, categoriaSinc } from '../componentes.js';

const DIA = 86400000;
export const venceu = (p, agora = Date.now()) => p.criadoEm > 0 && agora - p.criadoEm > (p.urgente ? 2 : 14) * DIA;

export function etapa(p) {
  if (p.concluidoEm > 0) return ['Concluído', 'var(--sucesso)'];
  if (p.escolhidoId) return ['Profissional escolhido', 'var(--agua-esc)'];
  if (p.encerrado) return ['Encerrado', 'var(--texto-3)'];
  if (venceu(p)) return ['Saiu do mural', 'var(--texto-3)'];
  if (p.interessados > 0) return [`${p.interessados} interessado${p.interessados > 1 ? 's' : ''}`, 'var(--violeta)'];
  return ['Publicado', 'var(--violeta)'];
}

export function resumoDoCliente(p) {
  const a = p.clientePedidosAntes || 0, f = p.clienteFechadosAntes || 0;
  if (!a) return 'Primeiro pedido desta pessoa aqui';
  if (!f) return `${a} pedidos antes · nenhum fechado ainda`;
  if (f === a) return `Fechou com alguém nos ${a} pedidos anteriores`;
  return `Fechou em ${f} dos ${a} pedidos anteriores`;
}

export function cartaoPedido(p, { meu = false } = {}) {
  const c = categoriaSinc(p.categoriaId);
  const [rot, cor] = etapa(p);
  return h('a.cartao.pedido', { href: `#/pedido/${p.id}`, style: { display: 'block', color: 'inherit' } },
    h('div.topo', h('span', { style: { fontSize: '18px' } }, c.e), h('span', c.nome), h('span.ponto-sep', tempoAtras(p.criadoEm)),
      p.urgente ? h('span.selo-urg', { style: { marginLeft: 'auto' } }, icone('raio', 'pp'), 'Urgente') : null),
    h('h3', p.titulo || c.nome),
    h('div.desc', (p.descricao || '').split('\n').filter(l => !l.startsWith('Serviço:')).join('\n')),
    h('div.rodape',
      h('span', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, icone('local', 'pp'), [p.bairro, p.cidade].filter(Boolean).join(', ') || 'Local a combinar'),
      meu ? h('span', { style: { color: cor, fontWeight: 700 } }, rot)
        : p.orcamentoAte > 0 ? h('span', `até ${reais(p.orcamentoAte)}`) : h('span', `${p.interessados || 0}/5 interessados`)));
}

export default async function telaMural({ D, params, ir }) {
  await categorias();
  const u = D.estado.usuario;
  let aba = params.get('meus') ? 'meus' : 'mural';
  const filtros = { urgentes: false, cidade: false, categoria: null };
  const meuProf = D.estado.visitante ? null : await D.meuPerfilProfissional();
  // Abre com todos os pedidos; o chip da categoria do profissional filtra quando ele quiser.

  const corpo = h('section.secao');
  const abas = h('div.abas', { role: 'tablist', style: { margin: '18px 0 0', position: 'relative', zIndex: 1, background: 'rgba(255,255,255,.16)' } });
  let parar = null;

  function pintarAbas() {
    abas.replaceChildren(...[['mural', 'Pedidos abertos'], ['meus', 'Meus pedidos']].map(([id, rot]) =>
      h('button', {
        role: 'tab', 'aria-selected': String(aba === id), style: aba === id ? null : { color: '#fff' },
        onclick: () => { aba = id; history.replaceState(null, '', id === 'meus' ? '#/mural?meus=1' : '#/mural'); pintarAbas(); ligar(); }
      }, rot)));
  }

  function ligar() {
    parar?.();
    corpo.replaceChildren(esqueletos(3));
    if (aba === 'meus') {
      if (D.estado.visitante) { corpo.replaceChildren(vazio('📋', 'Publique o que você precisa', 'Crie sua conta para publicar pedidos e receber propostas.', h('button.botao', { onclick: () => ir('/entrar?modo=cadastro') }, 'Criar conta'))); return; }
      parar = D.ouvirMeusPedidos(lista => {
        if (!lista.length) { corpo.replaceChildren(vazio('📋', 'Você ainda não publicou', 'Diga o que precisa em poucos toques, sem escrever nada. Até 5 profissionais se oferecem.', h('a.botao', { href: '#/publicar' }, icone('mais', 'p'), 'Publicar pedido'))); return; }
        corpo.replaceChildren(h('div.lista.grade-2', lista.map(p => cartaoPedido(p, { meu: true }))));
      });
      return;
    }
    parar = D.ouvirMural(todos => pintarMural(todos), () => corpo.replaceChildren(vazio('📡', 'Não consegui carregar o mural', 'Confira a internet.')));
  }

  function pintarMural(todos) {
    const agora = Date.now();
    let lista = todos.filter(p => !p.encerrado && p.clienteId !== u.id && !venceu(p, agora));
    const recentes = todos.filter(p => !p.encerrado && p.clienteId !== u.id && venceu(p, agora));
    if (filtros.urgentes) lista = lista.filter(p => p.urgente);
    if (filtros.cidade && u.cidade) lista = lista.filter(p => (p.cidade || '').toLowerCase() === u.cidade.toLowerCase());
    if (filtros.categoria) lista = lista.filter(p => p.categoriaId === filtros.categoria);
    lista.sort((a, b) => (b.urgente - a.urgente) || (b.criadoEm - a.criadoEm));

    const chips = h('div.atalhos', { style: { marginBottom: '12px' } },
      meuProf ? h('button.chip', { 'aria-pressed': String(!!filtros.categoria), onclick: () => { filtros.categoria = filtros.categoria ? null : meuProf.categoriaId; pintarMural(todos); } }, categoriaSinc(meuProf.categoriaId).nome) : null,
      h('button.chip', { 'aria-pressed': String(filtros.urgentes), onclick: () => { filtros.urgentes = !filtros.urgentes; pintarMural(todos); } }, icone('raio', 'pp'), 'Só urgentes'),
      u.cidade ? h('button.chip', { 'aria-pressed': String(filtros.cidade), onclick: () => { filtros.cidade = !filtros.cidade; pintarMural(todos); } }, icone('local', 'pp'), u.cidade) : null);

    const blocos = [chips];
    if (lista.length) blocos.push(h('div.secao-titulo', h('h2', `${lista.length} pedido${lista.length > 1 ? 's' : ''} aberto${lista.length > 1 ? 's' : ''}`), h('span.conta', 'urgentes primeiro')),
      h('div.lista.grade-2', lista.map(p => cartaoPedido(p))));
    else blocos.push(vazio('📭', 'Nenhum pedido aberto agora', 'Pedido sai do mural sozinho depois de 14 dias (urgente, 2 dias). Volte mais tarde ou publique o seu.'));
    // Pedidos que já venceram: mostrados à parte e marcados, para a vitrine não parecer vazia nem enganar.
    if (recentes.length && !filtros.urgentes) {
      blocos.push(h('details', { style: { marginTop: '18px' }, open: !lista.length },
        h('summary', { style: { cursor: 'pointer', fontWeight: 700, padding: '8px 6px', color: 'var(--texto-2)' } }, `Ver ${recentes.length} pedidos anteriores (já saíram do mural)`),
        h('div.lista.grade-2', { style: { marginTop: '8px', opacity: '.75' } }, recentes.sort((a, b) => b.criadoEm - a.criadoEm).slice(0, 30).map(p => cartaoPedido(p, { meu: true })))));
    }
    corpo.replaceChildren(...blocos);
  }

  const fab = h('a.fab', { href: '#/publicar' }, icone('mais'), h('span', 'Publicar pedido'));
  const rolar = () => fab.classList.toggle('recolhido', scrollY > 120);
  addEventListener('scroll', rolar, { passive: true });

  pintarAbas(); ligar();
  const el = h('div',
    h('header.cabecalho', h('div.sobre', 'Mural'), h('h1', aba === 'meus' ? 'Seus pedidos' : 'Quem está precisando'),
      h('div.recado', 'Cada pedido recebe no máximo 5 profissionais — sem telefone tocando sem parar.'), abas),
    corpo, fab);
  return { el, titulo: 'Mural', limpar: () => { parar?.(); removeEventListener('scroll', rolar); } };
}
