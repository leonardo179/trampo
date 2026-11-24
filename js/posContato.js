// "Como foi com fulano?" — as perguntas de dois botões que alimentam a taxa de resposta, o
// comparecimento e o "preço combinado". É o que faz os números do perfil serem medidos, e não
// declarados pelo próprio profissional.
import { h, icone, avatar, toast, tempoAtras } from './ui.js';
import { podeAvaliar, faltaParaAvaliar } from './reputacao.js';

const adiados = new Set(JSON.parse(sessionStorage.getItem('trampo-adiados') || '[]'));

/** O próximo passo de um contato, ou null se não há nada a perguntar. */
function passo(c) {
  if (c.respondeu == null) return 'resposta';
  if (c.respondeu && c.compareceu == null) return 'compareceu';
  if (c.respondeu && c.compareceu && c.precoCumpriu == null) return 'preco';
  if (c.respondeu && !c.avaliado) return 'avaliar';
  return null;
}

export function cartaoPosContato(D) {
  const caixa = h('div');
  const nomes = new Map();
  let lista = [];

  async function pintar() {
    // Só pergunta depois de um tempinho: "ele respondeu?" um minuto depois do clique não mede nada.
    const pend = lista.filter(c => passo(c) && !adiados.has(c.id) && Date.now() - c.criadoEm > 10 * 60000);
    if (!pend.length) { caixa.replaceChildren(); return; }
    const c = pend[0];
    if (!nomes.has(c.prestadorId)) {
      const p = await D.prestador(c.prestadorId).catch(() => null);
      nomes.set(c.prestadorId, p);
    }
    const p = nomes.get(c.prestadorId);
    if (!p) { adiados.add(c.id); pintar(); return; }
    const primeiro = p.nome.split(' ')[0];
    const etapa = passo(c);

    const responder = (fn, msg) => async () => {
      caixa.querySelectorAll('button').forEach(b => { b.disabled = true; });
      try { await fn(); if (msg) toast(msg, 'ok'); }
      catch (x) { toast(D.mensagemDeErro(x), 'erro'); caixa.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
    };
    const botoes = {
      resposta: [
        ['Sim, rápido', () => D.confirmarResposta(c, true, true)],
        ['Sim, mas demorou', () => D.confirmarResposta(c, true, false)],
        ['Não respondeu', () => D.confirmarResposta(c, false)],
      ],
      compareceu: [
        ['Apareceu no combinado', () => D.confirmarComparecimento(c, true)],
        ['Não apareceu', () => D.confirmarComparecimento(c, false)],
        ['Não chegamos a combinar', null],
      ],
      preco: [
        ['Sim, o combinado', () => D.confirmarPreco(c, true)],
        ['Não, cobrou mais', () => D.confirmarPreco(c, false)],
      ],
    };
    const pergunta = {
      resposta: `${primeiro} respondeu sua mensagem?`,
      compareceu: `Vocês combinaram e ${primeiro} apareceu?`,
      preco: 'O preço final foi o que vocês combinaram?',
      avaliar: `Como foi o serviço com ${primeiro}?`,
    }[etapa];

    let acoes;
    if (etapa === 'avaliar') {
      const pode = podeAvaliar(c, Date.now());
      acoes = pode
        ? [h('a.botao.peq', { href: `#/avaliar/${p.id}` }, icone('estrela', 'pp'), 'Avaliar agora')]
        : [h('span', { style: { fontSize: '13px', color: 'var(--texto-2)' } }, `Avaliação libera em ${Math.ceil(faltaParaAvaliar(c, Date.now()) / 60000)} min.`)];
    } else {
      acoes = botoes[etapa].map(([rot, fn], i) => h('button.botao.peq', {
        class: i ? 'sec' : '',
        onclick: fn ? responder(fn, 'Obrigado! Isso ajuda quem vem depois.') : () => { adiados.add(c.id); salvar(); pintar(); },
      }, rot));
    }
    caixa.replaceChildren(h('div.cartao.pos-contato',
      h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
        avatar(p.nome, p.fotoUrl, '', false, p.id),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { style: { fontSize: '12.5px', color: 'var(--texto-3)', fontWeight: 600 } }, `Você chamou ${tempoAtras(c.criadoEm)}`),
          h('div', { style: { fontWeight: 750, fontSize: '16px' } }, pergunta)),
        h('button.botao-redondo.claro', {
          'aria-label': 'Perguntar depois', style: { width: '34px', height: '34px', boxShadow: 'none', background: 'var(--superficie-2)' },
          onclick: () => { adiados.add(c.id); salvar(); pintar(); }
        }, icone('x', 'pp'))),
      h('div.pos-acoes', acoes),
      h('div', { style: { fontSize: '12px', color: 'var(--texto-3)', marginTop: '10px' } },
        'Sua resposta vira a taxa que aparece no perfil — é assim que o Trampo mostra quem responde de verdade.')));
  }
  const salvar = () => sessionStorage.setItem('trampo-adiados', JSON.stringify([...adiados]));
  const parar = D.ouvirContatos(l => { lista = l; pintar(); });
  return { el: caixa, parar };
}
