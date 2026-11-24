import { h, icone, toast, botaoCarregando, logo } from '../ui.js';

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

export default function acesso({ D, ir, params }) {
  let modo = params.get('modo') === 'cadastro' ? 'cadastro' : 'entrar';
  const jaVisitante = D.estado.visitante;
  const erro = h('div.erro', { role: 'alert' });
  const corpo = h('div');

  function campo(rot, input, ajuda) {
    const id = 'c' + Math.random().toString(36).slice(2, 8);
    input.id = id;
    return h('div.campo', h('label', { for: id }, rot), input, ajuda ? h('div.ajuda', ajuda) : null);
  }

  function formEntrar() {
    const email = h('input', { type: 'email', autocomplete: 'email', required: true, placeholder: 'voce@email.com', inputmode: 'email' });
    const senha = h('input', { type: 'password', autocomplete: 'current-password', required: true, placeholder: '••••••' });
    const botao = h('button.botao.largo', { type: 'submit' }, 'Entrar');
    return h('form', {
      onsubmit: e => {
        e.preventDefault(); erro.textContent = '';
        botaoCarregando(botao, D.entrar(email.value, senha.value).then(() => ir('/', { substituir: true }))
          .catch(x => { erro.textContent = D.mensagemDeErro(x); }));
      }
    },
      campo('E-mail', email), campo('Senha', senha), erro, botao,
      h('div', { style: { textAlign: 'center', marginTop: '14px' } },
        h('button.link', {
          type: 'button', onclick: async () => {
            if (!email.value.includes('@')) { erro.textContent = 'Escreva seu e-mail acima para receber o link.'; email.focus(); return; }
            try { await D.recuperarSenha(email.value); toast('Enviamos um link para ' + email.value, 'ok'); }
            catch (x) { erro.textContent = D.mensagemDeErro(x); }
          }
        }, 'Esqueci minha senha')),
      h('div.demo-dica', h('b', 'Quer só conhecer? '), 'Use ',
        h('button.link', { type: 'button', onclick: () => { email.value = 'demo@demo.com'; senha.value = 'demo123'; botao.click(); } }, 'a conta de demonstração'),
        ' ou entre como visitante.'));
  }

  function formCadastro() {
    const nome = h('input', { autocomplete: 'name', required: true, placeholder: 'Como você quer ser chamado' });
    const email = h('input', { type: 'email', autocomplete: 'email', required: true, placeholder: 'voce@email.com', inputmode: 'email' });
    const tel = h('input', { type: 'tel', autocomplete: 'tel', placeholder: '(11) 91234-5678', inputmode: 'tel' });
    tel.addEventListener('input', () => {
      const d = tel.value.replace(/\D/g, '').slice(0, 11);
      tel.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
    });
    const cidade = h('input', { autocomplete: 'address-level2', required: true, placeholder: 'São Paulo' });
    const uf = h('select', { autocomplete: 'address-level1' }, UFS.map(u => h('option', { value: u, selected: u === 'SP' }, u)));
    const bairro = h('input', { autocomplete: 'address-level3', placeholder: 'Pinheiros' });
    const senha = h('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: 6, placeholder: 'Pelo menos 6 caracteres' });
    const termos = h('input', { type: 'checkbox', required: true, style: { width: '20px', height: '20px', accentColor: 'var(--violeta)' } });
    const botao = h('button.botao.largo', { type: 'submit' }, 'Criar conta grátis');
    return h('form', {
      onsubmit: e => {
        e.preventDefault(); erro.textContent = '';
        botaoCarregando(botao, D.cadastrar({
          nome: nome.value, email: email.value, telefone: tel.value.replace(/\D/g, ''),
          cidade: cidade.value.trim(), estado: uf.value, bairro: bairro.value.trim(),
        }, senha.value).then(() => { toast('Conta criada. Bem-vindo!', 'ok'); ir('/', { substituir: true }); })
          .catch(x => { erro.textContent = D.mensagemDeErro(x); }));
      }
    },
      campo('Nome', nome), campo('E-mail', email),
      campo('WhatsApp', tel, 'Só aparece para quem você escolher chamar.'),
      h('div.duas', campo('Cidade', cidade), campo('Estado', uf)),
      campo('Bairro', bairro, 'Opcional — ajuda a achar quem está perto.'),
      campo('Senha', senha),
      h('label', { style: { display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', color: 'var(--texto-2)', margin: '2px 0 14px' } },
        termos, h('span', 'Li e aceito os ', h('a', { href: 'termos.html', target: '_blank' }, 'termos de uso'), ' e a ', h('a', { href: 'privacidade.html', target: '_blank' }, 'política de privacidade'), '.')),
      erro, botao);
  }

  const abas = h('div.abas', { role: 'tablist' });
  function desenhar() {
    erro.textContent = '';
    abas.replaceChildren(
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(modo === 'entrar'), onclick: () => { modo = 'entrar'; desenhar(); } }, 'Entrar'),
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(modo === 'cadastro'), onclick: () => { modo = 'cadastro'; desenhar(); } }, 'Criar conta'));
    corpo.replaceChildren(modo === 'entrar' ? formEntrar() : formCadastro());
  }
  desenhar();

  const visitante = jaVisitante
    ? h('button.botao.sec.largo', { type: 'button', onclick: () => history.length > 1 ? history.back() : ir('/', { substituir: true }) }, 'Continuar explorando')
    : h('button.botao.sec.largo', {
      type: 'button',
      onclick: () => botaoCarregando(visitante, D.entrarComoVisitante().then(() => ir('/', { substituir: true }))
        .catch(x => { erro.textContent = D.mensagemDeErro(x); }))
    }, 'Entrar como visitante');

  return h('div.acesso',
    h('section.acesso-arte',
      h('a', { href: '#/', style: { display: 'inline-block', marginBottom: '22px', position: 'relative', zIndex: 1 } }, logo(56, { cor: '#fff' })),
      h('h1', 'Quem precisa encontra quem faz.'),
      h('p', 'Eletricista, encanador, diarista e mais de 100 serviços perto de você. Escreva o problema do seu jeito — o Trampo entende.'),
      h('div.promessas',
        [['🆓', 'Falar com o profissional é grátis. Sempre.'],
         ['🚫', 'Sem moedas e sem taxa por contato.'],
         ['💬', 'Você vê quem responde de verdade.'],
         ['🤝', 'Preço e prazo combinados direto entre vocês.']]
          .map(([e, t]) => h('div.promessa', h('span.b', e), t)))),
    h('section.acesso-form',
      h('div.caixa',
        h('h2', modo === 'cadastro' ? 'Crie sua conta grátis' : 'Bem-vindo ao Trampo'),
        h('p.sub', 'Uma conta só para contratar e para trabalhar.'),
        abas, corpo,
        h('div.divisor', 'ou'),
        visitante,
        h('p', { style: { textAlign: 'center', fontSize: '12px', color: 'var(--texto-3)', marginTop: '22px' } },
          h('a', { href: '#/sobre' }, 'Conheça o Trampo'), ' · ', h('a', { href: 'termos.html' }, 'Termos'), ' · ', h('a', { href: 'privacidade.html' }, 'Privacidade')))));
}
