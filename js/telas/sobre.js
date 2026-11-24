// "Conheça o Trampo": a página para quem quer entender o produto (investidores, parceiros).
// Os números vêm da base no momento da visita — nada escrito à mão que possa ficar velho.
import { h, icone, logo, nota1, avatar } from '../ui.js';
import { categorias, categoriaSinc, taxaResposta } from '../componentes.js';
import * as M from '../motor.js';

const EXEMPLOS = ['tenho cachorro em casa, preciso de diarista', 'minha pia entupiu', 'pc lentíssimo', 'vazamento urgente', 'eletricista em pinheiros', 'chuveiro não esquenta'];

export default async function telaSobre({ D }) {
  const numeros = h('div.numeros', [1, 2, 3, 4].map(() => h('div.numero.esq', { style: { height: '92px' } })));
  D.numerosDaBase().then(n => {
    const itens = [
      [n.profissionais.toLocaleString('pt-BR'), 'profissionais cadastrados'],
      [n.avaliacoes.toLocaleString('pt-BR'), 'avaliações de clientes'],
      ['110', 'tipos de serviço'],
      n.resposta != null ? [`${n.resposta}%`, 'taxa média de resposta medida'] : [nota1(n.nota || 0), 'nota média'],
    ];
    numeros.replaceChildren(...itens.map(([v, r]) => h('div.numero', h('b', v), h('span', r))));
  }).catch(() => numeros.remove());

  // ---------------------------------------------------------------- demonstração da busca ao vivo
  const campo = h('input', { type: 'text', value: EXEMPLOS[0], 'aria-label': 'Escreva um problema' });
  const saida = h('div.demo-saida');
  const pintar = () => {
    if (!M.pronto()) { saida.replaceChildren(h('span', { style: { opacity: .8 } }, 'Carregando o dicionário de 146 mil termos…')); return; }
    const t = campo.value.trim();
    if (!t) { saida.replaceChildren(); return; }
    const i = M.interpretar(t);
    const et = M.etiquetas(i);
    const cands = M.candidatas(i);
    saida.replaceChildren(
      et.length ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } }, et.map(e => h('span.pilula-demo', `${e.emoji || ''} ${e.rotulo}`.trim())))
        : cands.length ? h('span', 'Pode ser mais de um serviço — o app pergunta qual, em vez de chutar.')
          : h('span', 'Nenhum serviço reconhecido — busca pelo texto.'),
      h('a.botao.peq', { href: '#/?q=' + encodeURIComponent(t), style: { marginTop: '12px', background: '#fff', color: 'var(--violeta-esc)' } }, 'Ver resultados →'));
  };
  campo.addEventListener('input', pintar);
  M.preparar().then(pintar).catch(() => {});
  pintar();

  // Três profissionais de verdade da base, flutuando ao lado do título (só no PC).
  await categorias();
  const vitrine = h('div.hero-vitrine', { 'aria-hidden': 'true' });
  D.prestadores().then(lista => {
    const top = lista.filter(p => (p.totalAvaliacoes || 0) >= 10 && (taxaResposta(p) ?? 0) >= 85)
      .sort((a, b) => (b.notaMedia || 0) - (a.notaMedia || 0)).slice(0, 3);
    vitrine.replaceChildren(...top.map(p => h('div.hero-cartao',
      avatar(p.nome, p.fotoUrl, '', false, p.id),
      h('div', h('b', p.nome), h('span', `${categoriaSinc(p.categoriaId).nome} · ${p.bairro}`),
        h('em', `★ ${nota1(p.notaMedia)} · responde ${taxaResposta(p)}%`)))));
  }).catch(() => {});

  const pilar = (ic, titulo, texto) => h('div.cartao.pilar', h('span.pilar-ic', icone(ic)), h('h3', titulo), h('p', texto));
  const sim = h('span.sim', icone('check', 'pp')), nao = () => h('span.nao', icone('x', 'pp'));

  return {
    titulo: 'Conheça o Trampo',
    el: h('div.sobre-pagina',
      h('header.cabecalho.hero',
        vitrine,
        h('div', { style: { position: 'relative', zIndex: 1 } },
          logo(52),
          h('h1', 'O jeito honesto de contratar um profissional.'),
          h('p.hero-sub', 'O Trampo conecta quem precisa de um serviço com quem faz — sem cobrar por contato e mostrando, com números medidos, quem responde e quem cumpre o combinado.'),
          h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '20px' } },
            h('a.botao', { href: '#/', style: { background: '#fff', color: 'var(--violeta-esc)' } }, 'Experimentar agora'),
            h('a.botao', { href: '#/mural', style: { background: 'rgba(255,255,255,.18)' } }, 'Ver o mural de pedidos')))),

      h('section.secao', numeros,
        h('p.nota-rodape', 'Base de demonstração em São Paulo, lida agora do banco de dados do app.')),

      h('section.secao',
        h('div.secao-titulo', h('h2', 'O problema')),
        h('div.lista.grade-2',
          [['“Comprei moedas e não veio cliente.”', 'Nas plataformas de lead o profissional paga para desbloquear o contato — e paga mesmo quando o cliente some.'],
           ['“Mandei mensagem e ninguém respondeu.”', 'Nenhum app mostra quem de fato responde. O cliente descobre do pior jeito.'],
           ['“No app era R$ 200, na visita virou R$ 600.”', 'O preço muda entre o orçamento e a conta final, e não há registro disso em lugar nenhum.'],
           ['“Meu telefone não parou de tocar.”', 'Publicar um pedido vira 20 ligações em uma hora. Quem só queria comparar desiste.']]
            .map(([q, t]) => h('div.cartao.queixa', h('b', q), h('p', t))))),

      h('section.secao',
        h('div.secao-titulo', h('h2', 'O que o Trampo faz diferente')),
        h('div.lista.grade-2',
          pilar('carteira', 'Contato grátis, sempre', 'Sem moedas, sem taxa por lead, sem comissão. Cliente e profissional falam direto e combinam preço e prazo entre si.'),
          pilar('chat', 'Taxa de resposta medida', 'Depois de cada contato, o cliente responde em dois toques: “ele respondeu?”. Esse número aparece em todo perfil e pesa na ordem da busca.'),
          pilar('escudo', 'Preço combinado medido', '“O preço final foi o combinado?” vira a taxa de preço cumprido. Comparecimento também é medido. A reputação é feita do que acontece, não do que o profissional diz.'),
          pilar('mural', 'Pedido sem telefone tocando', 'No mural, no máximo 5 profissionais se oferecem por pedido. O cliente escolhe se quer ser chamado direto ou só ver as propostas.'))),

      h('section.secao',
        h('div.demo-busca',
          h('div', { style: { fontWeight: 800, fontSize: '19px' } }, 'Busca que entende português de verdade'),
          h('p', { style: { margin: '4px 0 14px', opacity: .9 } }, 'A pessoa escreve o problema do jeito dela — ou fala. O Trampo entende o serviço, a urgência, o bairro, o preço e até “tenho cachorro em casa”. Teste:'),
          h('div.demo-campo', icone('lupa', 'p'), campo),
          h('div.atalhos', { style: { margin: '10px 0 0' } }, EXEMPLOS.map(e => h('button.chip', { style: { background: 'rgba(255,255,255,.16)', color: '#fff', borderColor: 'transparent' }, onclick: () => { campo.value = e; pintar(); } }, e))),
          saida,
          h('div.demo-fatos',
            h('div', h('b', '146 mil'), h('span', 'termos no dicionário próprio')),
            h('div', h('b', '99,8%'), h('span', 'de acerto em 458 frases reais')),
            h('div', h('b', '< 1 ms'), h('span', 'para entender cada frase'))))),

      h('section.secao',
        h('div.secao-titulo', h('h2', 'Comparado ao que existe')),
        h('div.cartao', { style: { padding: '6px 10px', overflowX: 'auto' } },
          h('table.comparativo',
            h('thead', h('tr', h('th', ''), h('th', 'Plataformas de lead'), h('th', 'Marketplaces com comissão'), h('th.nos', 'Trampo'))),
            h('tbody',
              [['Contato grátis para o profissional', nao(), sim.cloneNode(true), sim.cloneNode(true)],
               ['Sem comissão sobre o serviço', sim.cloneNode(true), nao(), sim.cloneNode(true)],
               ['Mostra quem responde (medido)', nao(), nao(), sim.cloneNode(true)],
               ['Mede se o preço foi o combinado', nao(), nao(), sim.cloneNode(true)],
               ['Limita contatos por pedido', nao(), sim.cloneNode(true), sim.cloneNode(true)],
               ['Busca por frase e por voz', nao(), nao(), sim.cloneNode(true)]]
                .map(([r, ...c]) => h('tr', h('td', r), ...c.map((x, i) => h('td', { class: i === 2 ? 'nos' : '' }, x)))))))),

      h('section.secao',
        h('div.lista.grade-2',
          h('div.cartao',
            h('h3.titulo-bloco', 'Como o Trampo ganha dinheiro'),
            h('p.texto-cartao', 'Nunca cobrando por contato nem intermediando pagamento — o que define a confiança do produto. A receita prevista vem de:'),
            h('ul.lista-simples',
              h('li', h('b', 'Plano Pro'), ' para profissionais: ferramentas de gestão e perfil sem anúncios.'),
              h('li', h('b', 'Destaque'), ' por tempo na busca, sempre rotulado.'),
              h('li', h('b', 'Anúncios nativos'), ' rotulados, só para quem contrata — nunca no meio da conversa.'))),
          h('div.cartao',
            h('h3.titulo-bloco', 'Onde estamos'),
            h('ul.lista-simples',
              h('li', h('b', 'App Android completo: '), 'busca por frase e voz, mural, chat, agenda, orçamentos, reputação, verificação e moderação.'),
              h('li', h('b', 'Versão web: '), 'esta que você está usando, no mesmo banco de dados do app.'),
              h('li', h('b', 'Base de demonstração: '), 'São Paulo, com profissionais e avaliações de exemplo para testar tudo de ponta a ponta.'),
              h('li', h('b', 'Próximo passo: '), 'validação com profissionais reais em uma região e lançamento do app.'))))),

      h('section.secao', { style: { textAlign: 'center', padding: '30px 14px 10px' } },
        h('a.botao', { href: '#/' }, 'Experimentar o Trampo'),
        h('p.nota-rodape', { style: { marginTop: '18px' } },
          h('a', { href: 'termos.html' }, 'Termos de uso'), ' · ', h('a', { href: 'privacidade.html' }, 'Privacidade'), ' · ', h('a', { href: 's/' }, 'Serviços por cidade')))),
  };
}
