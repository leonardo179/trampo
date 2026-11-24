import { h, icone, toast, botaoCarregando, logo } from '../ui.js';

/** E-mail confirmado é obrigatório: tela cheia até a pessoa tocar no link (ou sair). */
export default function telaConfirmar({ D, ir }) {
  const email = D.estado.usuario?.email || '';
  const ja = h('button.botao.largo', { style: { background: '#fff', color: 'var(--violeta-esc)' } }, 'Já confirmei');
  const reenviar = h('button.botao.largo', { style: { background: 'rgba(255,255,255,.16)' } }, 'Mandar o link de novo');
  const conferir = async (silencioso = false) => {
    const ok = await D.conferirEmail();
    if (ok) { toast('E-mail confirmado. Bem-vindo!', 'ok'); ir('/', { substituir: true }); }
    else if (!silencioso) toast('Ainda não vi a confirmação. Toque no link do e-mail e volte aqui.', 'erro');
  };
  ja.onclick = () => botaoCarregando(ja, conferir());
  reenviar.onclick = () => botaoCarregando(reenviar, D.reenviarConfirmacaoEmail()
    .then(() => toast('Enviamos um novo link. Veja também o spam.', 'ok'))
    .catch(x => toast(D.mensagemDeErro(x), 'erro')));
  // Quem confirma em outra aba e volta: confere sozinho.
  const aoVoltar = () => { if (document.visibilityState === 'visible') conferir(true); };
  document.addEventListener('visibilitychange', aoVoltar);
  return {
    limpar: () => document.removeEventListener('visibilitychange', aoVoltar),
    el: h('div.confirmar',
      h('div.confirmar-caixa',
        logo(64, { cor: '#fff' }),
        h('h1', 'Confirme seu e-mail'),
        h('p', 'Mandamos um link para ', h('b', email), '. Toque nele e volte aqui. ',
          'Isso protege você e quem vai te atender: ninguém usa o Trampo com o e-mail de outra pessoa.'),
        ja, reenviar,
        h('button.link', { style: { color: 'rgba(255,255,255,.85)', marginTop: '6px' }, onclick: () => D.sair() }, 'Usar outra conta'),
        h('p.confirmar-dica', icone('info', 'pp'), ' Não chegou? Veja a caixa de spam ou promoções.'))),
  };
}
