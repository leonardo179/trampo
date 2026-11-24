import { h, icone, toast, tempoAtras, reais, vazio, confirmar, botaoCarregando, folha } from '../ui.js';
import { categorias, categoriaSinc, cartaoPrestador } from '../componentes.js';
import { etapa, resumoDoCliente, venceu } from './mural.js';
import { voltar } from '../app.js';

export default async function telaPedido({ D, args, ir }) {
  await categorias();
  const u = D.estado.usuario;
  const corpo = h('section.secao');
  const cab = h('header.cabecalho');
  const el = h('div', cab, corpo);

  // O pedido muda enquanto a tela está aberta (gente se oferecendo): ouvir em tempo real.
  let parar = null;
  let pedido = null;
  const pararMural = D.ouvirMural(lista => {
    const achado = lista.find(p => p.id === args[0]);
    if (achado) { pedido = achado; pintar(); }
  }, () => {});
  parar = D.ouvirMeusPedidos(lista => {
    const achado = lista.find(p => p.id === args[0]);
    if (achado) { pedido = achado; pintar(); }
    else if (!pedido) setTimeout(() => { if (!pedido) corpo.replaceChildren(vazio('🔍', 'Pedido não encontrado', 'Ele pode ter sido encerrado.', h('a.botao', { href: '#/mural' }, 'Ir ao mural'))); }, 2500);
  });

  let interessadosCarregados = null;
  function pintar() {
    const p = pedido;
    const c = categoriaSinc(p.categoriaId);
    const meu = p.clienteId === u.id;
    const [rot, cor] = etapa(p);
    cab.replaceChildren(
      h('div.linha-topo', h('button.botao-redondo', { 'aria-label': 'Voltar', onclick: () => voltar('/mural') }, icone('voltar')),
        h('div.cresce', h('div.sobre', `${c.e} ${c.nome} · ${tempoAtras(p.criadoEm)}`), h('h1', { style: { fontSize: '22px', lineHeight: '28px' } }, p.titulo))),
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', position: 'relative', zIndex: 1 } },
        p.urgente ? h('span.selo-urg', icone('raio', 'pp'), 'Urgente') : null,
        h('span.pilula', { style: { background: 'rgba(255,255,255,.18)', padding: '3px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 600 } }, rot)));

    const blocos = [
      h('div.cartao',
        h('div.resumo-funil', (p.descricao || '').split('\n').filter(Boolean).map(l => {
          const i = l.indexOf(':');
          return i > 0 ? h('div', h('span', l.slice(0, i)), h('span', l.slice(i + 1).trim())) : h('div', h('span', l));
        })),
        h('div.info-linha', icone('local', 'p'), [p.bairro, p.cidade].filter(Boolean).join(', ') || 'Local a combinar'),
        p.orcamentoAte > 0 ? h('div.info-linha', icone('carteira', 'p'), `Pretende gastar até ${reais(p.orcamentoAte)}`) : null,
        h('div.info-linha', icone('usuario', 'p'), meu ? 'Você publicou este pedido' : `${(p.clienteNome || 'Cliente').split(' ')[0]} · ${resumoDoCliente(p)}`)),
    ];

    if (meu) {
      const lista = h('div', h('div.esq', { style: { height: '90px', borderRadius: '22px' } }));
      blocos.push(h('div.secao-titulo', { style: { marginTop: '18px' } }, h('h2', 'Quem se ofereceu'), h('span.conta', `${p.interessados || 0} de 5`)), lista);
      const chave = `${p.id}:${p.interessados}`;
      if (interessadosCarregados?.chave !== chave) {
        interessadosCarregados = { chave, promessa: D.interessadosDoPedido(p.id) };
      }
      interessadosCarregados.promessa.then(itens => {
        if (!itens.length) {
          lista.replaceChildren(vazio('⏳', 'Ainda ninguém', venceu(p) ? 'Este pedido já saiu do mural.' : 'Os profissionais da categoria estão vendo. Quando alguém se oferecer, aparece aqui.'));
          return;
        }
        lista.replaceChildren(h('div.lista.grade-2', itens.map(({ prestador, interesse }) => {
          const card = cartaoPrestador(D, prestador);
          const faixa = interesse.precoDe > 0 ? (interesse.precoAte > interesse.precoDe ? `${reais(interesse.precoDe)} a ${reais(interesse.precoAte)}` : reais(interesse.precoDe)) : null;
          if (faixa) card.querySelector('.corpo').append(h('div', { style: { marginTop: '6px', fontWeight: 750, color: 'var(--violeta)' } }, 'Proposta: ' + faixa));
          return card;
        })));
      }).catch(() => lista.replaceChildren(''));
      if (!p.encerrado) {
        const enc = h('button.botao.perigo.largo', {
          style: { marginTop: '18px' },
          onclick: async () => {
            if (!await confirmar('Encerrar o pedido?', 'Ele sai do mural e ninguém mais pode se oferecer.', 'Encerrar')) return;
            botaoCarregando(enc, D.encerrarPedido(p.id).then(() => toast('Pedido encerrado', 'ok')).catch(x => toast(D.mensagemDeErro(x), 'erro')));
          }
        }, 'Encerrar pedido');
        blocos.push(enc);
      }
    } else {
      blocos.push(h('div', { id: 'acao', style: { marginTop: '14px' } }));
      D.meuPerfilProfissional().then(prof => {
        const alvo = el.querySelector('#acao'); if (!alvo) return;
        if (!prof) {
          alvo.replaceWith(h('div.honesto', h('span', '🧰'), h('div', h('b', 'Só profissionais podem se oferecer'), 'Este pedido é de outra pessoa. No app Android você cria seu perfil profissional em um minuto.')));
          return;
        }
        const aberto = !p.encerrado && (p.interessados || 0) < 5 && !venceu(p);
        const direto = p.podemChamarDireto && p.clienteTelefone;
        alvo.replaceWith(h('div', { style: { display: 'grid', gap: '8px' } },
          aberto ? h('button.botao.largo', { onclick: () => oferecer(p) }, icone('maleta', 'p'), 'Tenho interesse') : h('div.honesto', h('span', 'ℹ️'), h('div', h('b', 'Pedido fechado para novas ofertas'), (p.interessados || 0) >= 5 ? 'Já tem 5 profissionais. O cliente está escolhendo.' : 'Ele saiu do mural.')),
          direto && aberto ? h('a.botao.zap.largo', { href: `https://wa.me/55${p.clienteTelefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Vi seu pedido "${p.titulo}" no Trampo.`)}`, target: '_blank', rel: 'noopener' }, icone('zap', 'p'), 'Chamar no WhatsApp') : null));
      });
    }
    corpo.replaceChildren(...blocos);
  }

  function oferecer(p) {
    folha(fechar => {
      const de = h('input', { type: 'number', inputmode: 'decimal', min: 0, placeholder: 'De R$' });
      const ate = h('input', { type: 'number', inputmode: 'decimal', min: 0, placeholder: 'Até R$' });
      const erro = h('div.erro');
      const enviar = h('button.botao', { type: 'submit' }, 'Enviar');
      return h('form', {
        onsubmit: e => {
          e.preventDefault();
          botaoCarregando(enviar, D.demonstrarInteresse(p, { precoDe: +de.value || 0, precoAte: +ate.value || 0 })
            .then(() => { toast('Pronto! O cliente vai ver sua proposta.', 'ok'); fechar(); })
            .catch(x => { erro.textContent = D.mensagemDeErro(x); }));
        }
      }, h('h2', 'Sua proposta'), h('p.sub', 'Opcional: uma faixa de preço ajuda o cliente a comparar. Se não sabe sem ver o serviço, deixe em branco.'),
        h('div.duas', h('div.campo', h('label', 'De'), de), h('div.campo', h('label', 'Até'), ate)), erro,
        h('div.acoes', h('button.botao.sec', { type: 'button', onclick: fechar }, 'Cancelar'), enviar));
    });
  }

  corpo.append(h('div.esq', { style: { height: '220px', borderRadius: '22px' } }));
  return { el, titulo: 'Pedido', limpar: () => { parar(); pararMural(); } };
}
