import { h, icone, avatar, toast, botaoCarregando, vazio } from '../ui.js';
import { categorias, categoriaSinc } from '../componentes.js';
import { ELOGIOS } from '../reputacao.js';
import { voltar } from '../app.js';

const ROTULOS = ['', 'Muito ruim', 'Ruim', 'Ok', 'Bom', 'Excelente'];

export default async function telaAvaliar({ D, args, ir }) {
  await categorias();
  const p = await D.prestador(args[0]);
  if (!p) return h('section.secao', vazio('🔍', 'Profissional não encontrado', ''));
  const primeiro = p.nome.split(' ')[0];
  let nota = 0;

  const estrelas = h('div.estrelas-grandes', { role: 'radiogroup', 'aria-label': 'Nota' });
  const rotulo = h('div', { style: { minHeight: '22px', fontWeight: 700, color: 'var(--texto-2)', marginTop: '6px' } }, 'Toque nas estrelas');
  const pintarEstrelas = () => {
    estrelas.replaceChildren(...[1, 2, 3, 4, 5].map(n => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(n === nota), 'aria-label': `${n} estrela${n > 1 ? 's' : ''}`,
      class: n <= nota ? 'acesa' : '', onclick: () => { nota = n; pintarEstrelas(); enviar.disabled = false; }
    }, '★')));
    rotulo.textContent = nota ? ROTULOS[nota] : 'Toque nas estrelas';
  };
  const texto = h('textarea', { rows: 4, maxlength: 1000, placeholder: `Conte como foi o serviço com ${primeiro}. Isso ajuda muito quem vem depois.` });
  const chips = h('div.atalhos', { style: { flexWrap: 'wrap', margin: '0 0 12px' } }, ELOGIOS.map(([e, frase]) =>
    h('button.chip', {
      type: 'button', onclick: ev => {
        const atual = texto.value.trim();
        if (!atual.toLowerCase().includes(frase.toLowerCase())) texto.value = (atual ? atual.replace(/[.!]?$/, '. ') : '') + frase;
        ev.currentTarget.setAttribute('aria-pressed', 'true');
      }
    }, `${e} ${frase}`)));
  const erro = h('div.erro');
  const enviar = h('button.botao.largo', {
    disabled: true, onclick: () => botaoCarregando(enviar, D.avaliar(p.id, nota, texto.value)
      .then(() => { toast('Avaliação publicada. Obrigado!', 'ok'); ir('/p/' + p.id, { substituir: true }); })
      .catch(x => { erro.textContent = D.mensagemDeErro(x); }))
  }, 'Publicar avaliação');
  pintarEstrelas();

  return {
    titulo: 'Avaliar ' + primeiro,
    el: h('div',
      h('header.cabecalho',
        h('div.linha-topo', h('button.botao-redondo', { 'aria-label': 'Voltar', onclick: () => voltar('/') }, icone('voltar')),
          h('div.cresce', h('div.sobre', categoriaSinc(p.categoriaId).nome), h('h1', `Avaliar ${primeiro}`)))),
      h('section.secao', { style: { maxWidth: '640px' } },
        h('div.cartao', { style: { textAlign: 'center', padding: '24px 18px' } },
          h('div', { style: { display: 'flex', justifyContent: 'center' } }, avatar(p.nome, p.fotoUrl, 'g', false, p.id)),
          h('div', { style: { fontWeight: 750, fontSize: '18px', marginTop: '10px' } }, p.nome),
          estrelas, rotulo),
        h('div.cartao', { style: { marginTop: '12px' } },
          h('div', { style: { fontWeight: 700, marginBottom: '10px' } }, 'O que se destacou? (opcional)'),
          chips,
          h('div.campo', { style: { marginBottom: 0 } }, texto)),
        h('div', { style: { margin: '14px 0', fontSize: '12.5px', color: 'var(--texto-3)', textAlign: 'center' } },
          'Sua avaliação aparece com seu primeiro nome. Avaliação suspeita é marcada para a moderação — nunca apagada.'),
        erro, enviar)),
  };
}
