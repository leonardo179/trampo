import { h, avatar, tempoAtras, esqueletos, vazio } from '../ui.js';

export default async function telaConversas({ D }) {
  const corpo = h('section.secao', esqueletos(3));
  const el = h('div',
    h('header.cabecalho', h('div.sobre', 'Conversas'), h('h1', 'Mensagens'),
      h('div.recado', 'Tudo o que foi combinado fica guardado aqui — é a prova quando algo dá errado.')),
    corpo);
  if (D.estado.visitante) {
    corpo.replaceChildren(vazio('💬', 'Converse sem passar seu número', 'Crie sua conta para falar com profissionais pelo Trampo.', h('button.botao', { onclick: () => D.sair() }, 'Criar conta grátis')));
    return { el, titulo: 'Conversas' };
  }
  const eu = D.uid();
  const parar = D.ouvirConversas(lista => {
    if (!lista.length) {
      corpo.replaceChildren(vazio('💬', 'Nenhuma conversa ainda', 'Abra o perfil de um profissional e toque em “Conversar”.', h('a.botao', { href: '#/' }, 'Procurar profissionais')));
      return;
    }
    corpo.replaceChildren(h('div.cartao', { style: { padding: '6px' } }, lista.map(c => {
      const souPrest = c.prestadorId === eu;
      const nome = souPrest ? c.clienteNome : c.prestadorNome;
      const nao = (souPrest ? c.naoLidasPrestador : c.naoLidasCliente) || 0;
      return h('a.conversa-item', { href: `#/conversa/${c.id}`, style: { color: 'inherit' } },
        avatar(nome || '?', ''),
        h('div.meio',
          h('div.nome', h('span', nome || 'Conversa', souPrest ? h('span', { style: { fontWeight: 500, color: 'var(--texto-3)', fontSize: '12px' } }, ' · cliente') : null),
            h('time', tempoAtras(c.ultimaEm || c.criadoEm))),
          h('div.ult', { style: nao ? { color: 'var(--texto)', fontWeight: 650 } : null },
            c.ultimaMensagem ? (c.ultimoAutor === eu ? 'Você: ' : '') + c.ultimaMensagem : (c.assunto ? `Sobre ${c.assunto}` : 'Conversa iniciada'))),
        nao ? h('span.nao', nao) : null);
    })));
  });
  return { el, titulo: 'Conversas', limpar: parar };
}
