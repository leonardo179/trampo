import { h, icone, avatar, toast, folha, confirmar, botaoCarregando } from '../ui.js';

let pedidoInstalar = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedidoInstalar = e; });

export default async function telaPerfil({ D, ir }) {
  const u = D.estado.usuario;
  const visitante = D.estado.visitante;
  const meuProf = visitante ? null : await D.meuPerfilProfissional();

  const linha = (ic, titulo, sub, acao, extra = {}) => h(extra.href ? 'a.menu-linha' : 'button.menu-linha',
    { onclick: acao, href: extra.href, style: { color: 'inherit' } },
    h('span.ic', { style: extra.cor ? { color: extra.cor } : null }, icone(ic, 'p')),
    h('span', titulo, sub ? h('span.sub', sub) : null),
    h('span.seta', icone('direita', 'p')));

  function editar() {
    folha(fechar => {
      const nome = h('input', { value: u.nome || '', autocomplete: 'name' });
      const tel = h('input', { value: u.telefone || '', type: 'tel', inputmode: 'tel', autocomplete: 'tel' });
      const cidade = h('input', { value: u.cidade || '', autocomplete: 'address-level2' });
      const bairro = h('input', { value: u.bairro || '', autocomplete: 'address-level3' });
      const erro = h('div.erro');
      const salvar = h('button.botao', { type: 'submit' }, 'Salvar');
      const c = (r, i) => h('div.campo', h('label', r), i);
      return h('form', {
        onsubmit: e => {
          e.preventDefault();
          if (!nome.value.trim()) { erro.textContent = 'O nome não pode ficar vazio.'; return; }
          botaoCarregando(salvar, D.salvarUsuario({
            nome: nome.value.trim(), telefone: tel.value.replace(/\D/g, ''), cidade: cidade.value.trim(), bairro: bairro.value.trim(),
          }).then(() => { toast('Dados salvos', 'ok'); fechar(); ir('/perfil', { substituir: true }); })
            .catch(x => { erro.textContent = D.mensagemDeErro(x); }));
        }
      }, h('h2', 'Seus dados'), h('p.sub', 'Cidade e bairro ajudam a ordenar quem está mais perto.'),
        c('Nome', nome), c('WhatsApp', tel), h('div.duas', c('Cidade', cidade), c('Bairro', bairro)), erro,
        h('div.acoes', h('button.botao.sec', { type: 'button', onclick: fechar }, 'Cancelar'), salvar));
    });
  }

  const instalar = h('div');
  const pintarInstalar = () => {
    instalar.replaceChildren(pedidoInstalar ? linha('baixar', 'Instalar o Trampo', 'Abre como app, direto da tela inicial', async () => {
      pedidoInstalar.prompt(); await pedidoInstalar.userChoice; pedidoInstalar = null; pintarInstalar();
    }) : '');
  };
  pintarInstalar();

  const el = h('div',
    h('header.cabecalho',
      h('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', position: 'relative', zIndex: 1 } },
        avatar(u.nome, u.fotoUrl, '', false),
        h('div', { style: { minWidth: 0 } },
          h('div.sobre', visitante ? 'Visitante' : u.email),
          h('h1', { style: { margin: 0 } }, visitante ? 'Você está explorando' : u.nome),
          h('div.recado', visitante ? 'Crie a conta para chamar, salvar e publicar.' : [u.bairro, u.cidade].filter(Boolean).join(', ') || 'Complete seus dados')))),

    visitante ? h('section.secao', h('div.cartao',
      h('div', { style: { fontWeight: 750, fontSize: '16px', marginBottom: '6px' } }, 'Uma conta só para tudo'),
      h('p', { style: { margin: '0 0 14px', color: 'var(--texto-2)', fontSize: '14px' } }, 'Com ela você chama profissionais, guarda favoritos, publica pedidos — e, se quiser, também oferece seus serviços.'),
      h('button.botao.largo', { onclick: () => D.sair() }, 'Criar conta grátis'))) : null,

    h('section.secao', h('div.cartao', { style: { padding: '4px 16px' } },
      visitante ? null : linha('usuario', 'Meus dados', 'Nome, WhatsApp, cidade e bairro', editar),
      visitante ? null : linha('mural', 'Meus pedidos', 'O que você publicou no mural', null, { href: '#/mural?meus=1' }),
      visitante ? null : linha('chat', 'Conversas', 'Mensagens com profissionais', null, { href: '#/conversas' }),
      meuProf ? linha('maleta', 'Meu perfil profissional', 'Veja como os clientes enxergam você', null, { href: `#/p/${u.id}`, cor: 'var(--agua-esc)' }) : null,
      instalar)),

    h('section.secao', h('div.cartao', { style: { padding: '4px 16px' } },
      linha('escudo', 'Como o Trampo funciona', 'Sem moeda, sem taxa, sem comissão', () => folha(f => [
        h('h2', 'O combinado do Trampo'),
        ...[['🆓', 'Ver e falar com um profissional é de graça. Sempre.'],
          ['🚫', 'Não vendemos moedas nem cobramos por contato liberado.'],
          ['💬', 'A taxa de resposta vem da pergunta que fazemos a cada cliente: "ele respondeu?".'],
          ['⭐', 'Nota com peso no tempo: quem piorou perde estrela, e uma nota 5 sozinha não vence cinquenta 4,8.'],
          ['🛡️', 'Avaliação suspeita é marcada para a moderação, nunca apagada.'],
          ['🤝', 'Preço e prazo são combinados direto entre vocês dois. O Trampo não intermedia pagamento.']]
          .map(([e, t]) => h('div', { style: { display: 'flex', gap: '12px', padding: '8px 0', fontSize: '14.5px', color: 'var(--texto-2)' } }, h('span', e), t)),
        h('div.acoes', h('button.botao', { onclick: f }, 'Entendi'))])),
      h('button.menu-linha', {
        style: { color: 'var(--perigo)' },
        onclick: async () => { if (await confirmar('Sair da conta?', visitante ? 'O que você viu como visitante não fica guardado.' : 'Você pode entrar de novo quando quiser.', 'Sair')) D.sair(); }
      }, h('span.ic', { style: { color: 'var(--perigo)' } }, icone('sair', 'p')), h('span', 'Sair')))),

    h('p', { style: { textAlign: 'center', fontSize: '12px', color: 'var(--texto-3)', padding: '20px' } }, 'Trampo web · versão de demonstração'));

  return { el, titulo: 'Perfil' };
}
