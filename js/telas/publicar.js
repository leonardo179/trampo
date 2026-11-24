// O funil do mural: categoria → serviço → perguntas do serviço → quando/onde/quanto → publicar.
// Nenhuma resposta é texto livre: o pedido sai sempre no mesmo formato e dá para orçar (Funil.kt).
import { h, icone, toast, botaoCarregando, vazio } from '../ui.js';
import { categorias, categoriaSinc } from '../componentes.js';
import { voltar } from '../app.js';
import * as M from '../motor.js';

let FUNIL = null;
const carregarFunil = () => FUNIL ||= fetch(new URL('../../data/funil.json', import.meta.url)).then(r => r.json());
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default async function telaPublicar({ D, params, ir }) {
  const [funil, cats] = await Promise.all([carregarFunil(), categorias()]);
  const u = D.estado.usuario;
  if (D.estado.visitante) {
    return h('div', h('header.cabecalho', h('div.sobre', 'Mural'), h('h1', 'Publicar um pedido')),
      h('section.secao', vazio('📋', 'Crie sua conta para publicar', 'Assim quem se oferecer sabe com quem está falando, e você recebe as propostas aqui.',
        h('button.botao', { onclick: () => ir('/entrar?modo=cadastro') }, 'Criar conta grátis'))));
  }

  const comCats = new Set(funil.servicos.map(s => s.c));
  const st = { cat: params.get('c') ? +params.get('c') : null, servico: null, respostas: new Map(), passo: 0, bairro: u.bairro || '', cidade: u.cidade || '' };
  const corpo = h('section.secao');
  const titulo = h('h1', 'Publicar um pedido');
  const sobre = h('div.sobre', 'Mural');
  const passos = h('div.funil-passos');
  const btnVoltar = h('button.botao-redondo', { 'aria-label': 'Voltar', onclick: () => anterior() }, icone('voltar'));

  const perguntas = () => st.servico ? [...st.servico.extras, ...funil.comuns] : [];
  // Etapas: 0 categoria · 1 serviço · 2..n perguntas · n+1 local e revisão
  const totalEtapas = () => 2 + (st.servico ? perguntas().length : funil.comuns.length + 2) + 1;

  function anterior() {
    if (st.passo === 0) { voltar('/mural'); return; }
    st.passo--;
    if (st.passo === 1 && st.servico && funil.servicos.filter(s => s.c === st.cat).length === 1) st.passo = 0;
    pintar();
  }
  function seguir() { st.passo++; pintar(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  function pintar() {
    const total = totalEtapas();
    passos.replaceChildren(...Array.from({ length: total }, (_, i) => h('i', { class: i <= st.passo ? 'feito' : '' })));
    if (st.passo === 0) return pintarCategoria();
    if (st.passo === 1) return pintarServico();
    const ps = perguntas();
    if (st.passo - 2 < ps.length) return pintarPergunta(ps[st.passo - 2]);
    pintarRevisao();
  }

  function pintarCategoria() {
    sobre.textContent = 'Passo 1'; titulo.textContent = 'O que você precisa?';
    const frase = h('input', { type: 'text', placeholder: 'Conte com suas palavras: "a pia entupiu"', enterkeyhint: 'next' });
    const dica = h('div.erro', { style: { color: 'var(--texto-2)', fontWeight: 500 } });
    const usarFrase = async () => {
      const t = frase.value.trim(); if (!t) return;
      await M.preparar().catch(() => {});
      const i = M.pronto() ? M.interpretar(t) : null;
      const cat = i && M.temCategoria(i) ? M.categoriaDe(i) : null;
      if (!cat || !comCats.has(cat)) { dica.textContent = 'Não reconheci o serviço. Escolha a categoria abaixo.'; return; }
      st.cat = cat;
      // Serviço pela frase: o que tiver mais palavras do nome presentes no texto.
      const nt = norm(t);
      const melhor = funil.servicos.filter(s => s.c === cat)
        .map(s => [s, norm(s.nome).split(/\W+/).filter(w => w.length > 3 && nt.includes(w.slice(0, -1))).length])
        .sort((a, b) => b[1] - a[1])[0];
      if (melhor && melhor[1] > 0) { st.servico = melhor[0]; st.respostas.clear(); st.passo = 2; pintar(); }
      else seguir();
    };
    const destaque = [1, 2, 5, 3, 8, 11, 21, 28].filter(id => comCats.has(id));
    const outras = [...cats.values()].filter(c => comCats.has(c.id) && !destaque.includes(c.id)).sort((a, b) => a.nome.localeCompare(b.nome));
    corpo.replaceChildren(
      h('form.cartao', { onsubmit: e => { e.preventDefault(); usarFrase(); } },
        h('div.campo', { style: { marginBottom: '6px' } }, h('label', 'Atalho: escreva e eu escolho por você'),
          h('div', { style: { display: 'flex', gap: '8px' } }, frase, h('button.botao.peq', { type: 'submit', style: { height: '50px' } }, 'Ir'))),
        dica),
      h('div.secao-titulo', { style: { marginTop: '18px' } }, h('h2', 'Ou toque na categoria')),
      h('div.grade-cat', destaque.map(id => { const c = categoriaSinc(id); return h('button.cat', { onclick: () => escolherCat(id) }, h('span.emo', c.e), h('span.rot', c.nome)); })),
      h('details', { style: { marginTop: '14px' } }, h('summary', { style: { cursor: 'pointer', fontWeight: 700, padding: '8px 6px', color: 'var(--violeta)' } }, `Ver todas as ${comCats.size} categorias`),
        h('div.grade-cat', { style: { marginTop: '8px' } }, outras.map(c => h('button.cat', { onclick: () => escolherCat(c.id) }, h('span.emo', c.e), h('span.rot', c.nome))))));
  }
  function escolherCat(id) {
    if (st.cat !== id) { st.servico = null; st.respostas.clear(); }
    st.cat = id;
    const sv = funil.servicos.filter(s => s.c === id);
    if (sv.length === 1) { st.servico = sv[0]; st.passo = 2; pintar(); } else seguir();
  }

  function pintarServico() {
    const c = categoriaSinc(st.cat);
    sobre.textContent = `${c.e} ${c.nome}`; titulo.textContent = 'Qual serviço?';
    const sv = funil.servicos.filter(s => s.c === st.cat);
    corpo.replaceChildren(h('div.opcoes', sv.map(s => h('button.opcao', {
      'aria-pressed': String(st.servico?.id === s.id),
      onclick: () => { if (st.servico?.id !== s.id) st.respostas.clear(); st.servico = s; seguir(); }
    }, h('span.emo', s.e || c.e), s.nome, h('span.marca', icone('check', 'pp'))))));
  }

  function pintarPergunta(p) {
    sobre.textContent = st.servico.nome; titulo.textContent = p.titulo;
    const escolhidas = new Set((st.respostas.get(p.id) || []).map(o => o.id));
    const continuar = h('button.botao.largo', { disabled: !p.opcional && !escolhidas.size, onclick: () => seguir() }, 'Continuar');
    const botoes = p.opcoes.map(o => {
      const b = h('button.opcao', {
        'aria-pressed': String(escolhidas.has(o.id)),
        onclick: () => {
          if (p.multipla) {
            escolhidas.has(o.id) ? escolhidas.delete(o.id) : escolhidas.add(o.id);
            b.setAttribute('aria-pressed', String(escolhidas.has(o.id)));
            st.respostas.set(p.id, p.opcoes.filter(x => escolhidas.has(x.id)));
            continuar.disabled = !p.opcional && !escolhidas.size;
          } else {
            st.respostas.set(p.id, [o]);
            botoes.forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true');
            setTimeout(seguir, 160); // escolha única avança sozinha, com um respiro para ver a marca
          }
        }
      }, o.e ? h('span.emo', o.e) : null, o.r, h('span.marca', icone('check', 'pp')));
      return b;
    });
    corpo.replaceChildren(
      p.ajuda ? h('p', { style: { margin: '0 6px 14px', color: 'var(--texto-2)', fontSize: '14px' } }, p.ajuda) : '',
      h('div.opcoes', botoes),
      (p.multipla || p.opcional) ? h('div.funil-rodape',
        p.opcional ? h('button.botao.sec', { onclick: () => { st.respostas.delete(p.id); seguir(); } }, 'Pular') : null, continuar) : '');
  }

  function montarTitulo() {
    const ids = ['comodo', 'aparelho', 'veiculo', 'praga', 'movel', 'sistema', 'btus', 'porte'];
    const r = ids.map(i => st.respostas.get(i)?.[0]).find(Boolean);
    return r ? `${st.servico.nome} — ${r.r}` : st.servico.nome;
  }
  function montarDescricao() {
    const linhas = [`Serviço: ${st.servico.nome}`];
    for (const p of perguntas()) {
      const r = st.respostas.get(p.id);
      if (r?.length) linhas.push(`${p.titulo.replace(/\?$/, '')}: ${r.map(o => o.r).join(', ')}`);
    }
    return linhas.join('\n');
  }

  function pintarRevisao() {
    sobre.textContent = 'Último passo'; titulo.textContent = 'Confira e publique';
    const bairro = h('input', { value: st.bairro, placeholder: 'Bairro', autocomplete: 'address-level3', oninput: e => { st.bairro = e.target.value; } });
    const cidade = h('input', { value: st.cidade, placeholder: 'Cidade', autocomplete: 'address-level2', oninput: e => { st.cidade = e.target.value; } });
    const erro = h('div.erro');
    const publicar = h('button.botao.largo', {
      onclick: () => {
        if (!st.cidade.trim()) { erro.textContent = 'Diga a cidade para os profissionais certos verem.'; cidade.focus(); return; }
        const teto = +(st.respostas.get('orcamento')?.[0]?.id || 0);
        const urgente = st.respostas.get('prazo')?.some(o => o.id === 'hoje') || false;
        const direto = st.respostas.get('contato')?.[0]?.id !== 'escolho';
        botaoCarregando(publicar, D.publicarPedido({
          titulo: montarTitulo(), descricao: montarDescricao(), categoriaId: st.cat,
          bairro: st.bairro.trim(), cidade: st.cidade.trim(), urgente, podemChamarDireto: direto, orcamentoAte: teto,
        }).then(id => { toast('Pedido publicado! Avisamos quando alguém se oferecer.', 'ok'); ir('/pedido/' + id, { substituir: true }); })
          .catch(x => { erro.textContent = D.mensagemDeErro(x); }));
      }
    }, icone('enviar', 'p'), 'Publicar pedido');
    corpo.replaceChildren(
      h('div.cartao',
        h('div', { style: { fontWeight: 750, fontSize: '17px', marginBottom: '6px' } }, montarTitulo()),
        h('div.resumo-funil', perguntas().map(p => {
          const r = st.respostas.get(p.id);
          return r?.length ? h('div', h('span', p.titulo.replace(/\?$/, '')), h('span', r.map(o => o.r).join(', '))) : '';
        }))),
      h('div.cartao', { style: { marginTop: '12px' } },
        h('div', { style: { fontWeight: 700, marginBottom: '10px' } }, 'Onde?'),
        h('div.duas', h('div.campo', h('label', 'Bairro'), bairro), h('div.campo', h('label', 'Cidade'), cidade)),
        h('div.ajuda', { style: { fontSize: '12.5px', color: 'var(--texto-3)' } }, 'O endereço completo você só passa para quem escolher.')),
      h('div.honesto', { style: { marginTop: '12px' } }, h('span', '🛡️'),
        h('div', h('b', 'Como funciona'), 'Até 5 profissionais podem se oferecer. O pedido sai do mural sozinho em 14 dias (urgente, 2 dias). ',
          st.respostas.get('contato')?.[0]?.id === 'escolho' ? 'Seu telefone não aparece: você escolhe quem chamar.' : 'Seu WhatsApp aparece para quem se oferecer.')),
      h('div.funil-rodape', h('div', { style: { flex: 1 } }, erro, publicar)));
  }

  if (st.cat && comCats.has(st.cat)) {
    const sv = funil.servicos.filter(s => s.c === st.cat);
    if (sv.length === 1) { st.servico = sv[0]; st.passo = 2; } else st.passo = 1;
  } else st.cat = null;
  pintar();
  return {
    titulo: 'Publicar pedido',
    el: h('div', h('header.cabecalho',
      h('div.linha-topo', btnVoltar, h('div.cresce', sobre, titulo)), passos), corpo),
  };
}
