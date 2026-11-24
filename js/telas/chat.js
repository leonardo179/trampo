import { h, icone, avatar, hora, diaRotulo, toast, vazio } from '../ui.js';
import { voltar } from '../app.js';

export default async function telaChat({ D, args }) {
  const c = await D.conversa(args[0]).catch(() => null);
  if (!c) return h('section.secao', vazio('💬', 'Conversa não encontrada', '', h('a.botao', { href: '#/conversas' }, 'Ver conversas')));
  const eu = D.uid();
  const souPrest = c.prestadorId === eu;
  const outroNome = souPrest ? c.clienteNome : c.prestadorNome;
  const outroId = souPrest ? c.clienteId : c.prestadorId;

  const msgs = h('div.chat-msgs', { role: 'log', 'aria-live': 'polite' });
  const caixa = h('textarea', { rows: 1, placeholder: 'Escreva uma mensagem', 'aria-label': 'Mensagem', maxlength: 2000, enterkeyhint: 'send' });
  const enviar = h('button', { type: 'submit', 'aria-label': 'Enviar', disabled: true }, icone('enviar', 'p'));
  const ajustar = () => {
    caixa.style.height = 'auto'; caixa.style.height = Math.min(caixa.scrollHeight, 140) + 'px';
    enviar.disabled = !caixa.value.trim();
  };
  caixa.addEventListener('input', ajustar);
  // Enter envia no PC; no celular o Enter quebra linha (o botão envia).
  caixa.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer: fine)').matches) { e.preventDefault(); form.requestSubmit(); }
  });
  const form = h('form.chat-envio', {
    onsubmit: async e => {
      e.preventDefault();
      const t = caixa.value; if (!t.trim()) return;
      caixa.value = ''; ajustar();
      try { await D.enviarMensagem(c.id, t); }
      catch (x) { caixa.value = t; ajustar(); toast(D.mensagemDeErro(x), 'erro'); }
    }
  }, caixa, enviar);

  let primeira = true;
  const parar = D.ouvirMensagens(c.id, lista => {
    const pertoDoFim = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 120;
    const nos = [];
    if (!lista.length) nos.push(h('div.msg.sistema', 'Comece contando o que precisa. Combine preço e prazo por aqui — fica registrado.'));
    let dia = '';
    for (const m of lista) {
      const d = diaRotulo(m.criadoEm);
      if (d !== dia) { dia = d; nos.push(h('div.dia', d)); }
      const texto = m.tipo === 'ORCAMENTO' ? `💰 Orçamento: R$ ${(m.valor || 0).toLocaleString('pt-BR')}${m.texto ? '\n' + m.texto : ''}`
        : m.tipo === 'ACEITE' ? '✅ Orçamento aceito' : m.tipo === 'RECUSA' ? 'Não pode atender agora'
        : m.fotoUrl && !m.texto ? '📷 Foto' : m.texto;
      nos.push(h('div.msg', { class: m.autorId === eu ? 'minha' : '' },
        m.fotoUrl ? h('img', { src: m.fotoUrl, alt: 'Foto', loading: 'lazy', style: { borderRadius: '12px', marginBottom: texto ? '6px' : 0, maxHeight: '260px' } }) : null,
        texto, h('time', hora(m.criadoEm))));
    }
    msgs.replaceChildren(...nos);
    if (primeira || pertoDoFim) msgs.scrollTop = msgs.scrollHeight;
    primeira = false;
    D.conversa(c.id).then(atual => atual && D.marcarConversaLida(atual)).catch(() => {});
  });

  const el = h('div.chat',
    h('div.chat-topo',
      h('button.botao-redondo', { 'aria-label': 'Voltar', onclick: () => voltar('/conversas') }, icone('voltar')),
      avatar(outroNome || '?', '', '', false, outroId),
      h(souPrest ? 'div' : 'a', { href: souPrest ? null : `#/p/${outroId}`, style: { color: '#fff', minWidth: 0 } },
        h('div.nome', outroNome || 'Conversa'), c.assunto ? h('div.assunto', c.assunto) : null)),
    msgs, form);
  // O chat ocupa a altura toda: some a folga de baixo da página.
  document.getElementById('conteudo')?.style.setProperty('padding-bottom', '0');
  setTimeout(() => matchMedia('(pointer: fine)').matches && caixa.focus(), 50);
  return {
    el, titulo: outroNome,
    limpar: () => { parar(); document.getElementById('conteudo')?.style.removeProperty('padding-bottom'); },
  };
}
