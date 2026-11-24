// Criar ou editar o perfil profissional pela web (antes só existia no app Android).
// Grava só os campos do dono; nota, contadores e verificação nascem zerados (regra nasceZerado).
import { h, icone, toast, botaoCarregando, vazio, acoesConta, folha } from '../ui.js';
import { categorias } from '../componentes.js';
import { voltar } from '../app.js';

const DIAS = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [0, 'Dom']];
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default async function telaProfissional({ D, ir }) {
  if (D.estado.visitante) {
    return h('div', h('header.cabecalho', h('div.sobre', 'Para profissionais'), h('h1', 'Ofereça seus serviços')),
      h('section.secao', vazio('🧰', 'Crie sua conta primeiro', 'Com a conta você monta seu perfil profissional em 2 minutos. Sem mensalidade e sem pagar por cliente.',
        acoesConta(ir))));
  }
  const cats = [...(await categorias()).values()].sort((a, b) => a.nome.localeCompare(b.nome));
  const u = D.estado.usuario;
  const atual = await D.meuPerfilProfissional();
  const novo = !atual;
  const st = {
    categoriaId: atual?.categoriaId || null,
    categoriasExtras: [...(atual?.categoriasExtras || [])],
    diasSemana: new Set(atual?.diasSemana || [1, 2, 3, 4, 5]),
    fotos: [...(atual?.fotos || [])],
    antesDepois: [...(atual?.antesDepois || [])],
  };

  const c = (rot, input, ajuda) => h('div.campo', h('label', rot), input, ajuda ? h('div.ajuda', ajuda) : null);

  // ---------------------------------------------------------------- categoria (com filtro)
  const escolhida = h('div');
  const pintarCat = () => {
    const principal = cats.find(x => x.id === st.categoriaId);
    escolhida.replaceChildren(
      principal ? h('div.chip.etiqueta', { style: { height: '40px', fontSize: '14.5px' } }, `${principal.e} ${principal.nome}`) : h('span', { style: { color: 'var(--texto-3)' } }, 'Nenhuma escolhida'),
      st.categoriasExtras.length ? h('div.atalhos', { style: { flexWrap: 'wrap', marginTop: '8px' } }, st.categoriasExtras.map(id => {
        const x = cats.find(k => k.id === id);
        return x ? h('span.chip.etiqueta', `${x.e} ${x.nome}`, h('button.x', { type: 'button', 'aria-label': 'Tirar', onclick: () => { st.categoriasExtras = st.categoriasExtras.filter(i => i !== id); pintarCat(); } }, icone('x', 'pp'))) : '';
      })) : '');
  };
  const filtro = h('input', { placeholder: 'Procure: eletricista, faxina, manicure…', type: 'search' });
  const listaCats = h('div.lista-cats');
  const pintarLista = () => {
    const q = norm(filtro.value.trim());
    const achadas = cats.filter(x => !q || norm(x.nome).includes(q)).slice(0, q ? 30 : 12);
    listaCats.replaceChildren(...achadas.map(x => h('button.chip', {
      type: 'button', 'aria-pressed': String(x.id === st.categoriaId || st.categoriasExtras.includes(x.id)),
      onclick: () => {
        if (!st.categoriaId || st.categoriaId === x.id) st.categoriaId = x.id;
        else if (st.categoriasExtras.includes(x.id)) st.categoriasExtras = st.categoriasExtras.filter(i => i !== x.id);
        else if (st.categoriasExtras.length < 3) st.categoriasExtras.push(x.id);
        else toast('Até 3 serviços extras.');
        pintarCat(); pintarLista();
      }
    }, `${x.e} ${x.nome}`)));
  };
  filtro.addEventListener('input', pintarLista);
  pintarCat(); pintarLista();

  // ---------------------------------------------------------------- resto do formulário
  const desc = h('textarea', { rows: 5, maxlength: 1500, placeholder: 'O que você faz, há quanto tempo, o que te diferencia. Ex.: "Eletricista com NR-10, faço instalação, troca de disjuntor e chuveiro. Orçamento sem compromisso."' }, atual?.descricao || '');
  const anos = h('input', { type: 'number', min: 0, max: 60, inputmode: 'numeric', value: atual?.anosExperiencia || '' });
  const bairro = h('input', { value: atual?.bairro || u.bairro || '', autocomplete: 'address-level3' });
  const cidade = h('input', { value: atual?.cidade || u.cidade || '', autocomplete: 'address-level2' });
  const tel = h('input', { type: 'tel', inputmode: 'tel', value: atual?.telefone || u.telefone || '', placeholder: '(11) 91234-5678' });
  const visita = h('input', { type: 'number', min: 0, inputmode: 'decimal', value: atual?.precoVisita || '', placeholder: 'R$' });
  const hora = h('input', { type: 'number', min: 0, inputmode: 'decimal', value: atual?.precoHora || '', placeholder: 'R$' });
  const ini = h('input', { type: 'time', value: atual?.horaInicio || '08:00' });
  const fim = h('input', { type: 'time', value: atual?.horaFim || '18:00' });
  const genero = h('select', h('option', { value: '' }, 'Prefiro não dizer'), h('option', { value: 'F', selected: atual?.genero === 'F' }, 'Mulher'), h('option', { value: 'M', selected: atual?.genero === 'M' }, 'Homem'));
  const marca = (rot, sub, val) => {
    const i = h('input', { type: 'checkbox', checked: !!val });
    return { i, el: h('label.alternar', i, h('span', h('b', rot), h('small', sub))) };
  };
  const urg = marca('Atendo urgência 24 h', 'Aparece em "Estou com pressa".', atual?.urgencia24h);
  const pet = marca('Aceito casa com pet', 'Filtro "tenho cachorro em casa".', atual?.petFriendly);
  const oculto = marca('Esconder meu telefone', 'Clientes só falam com você pelo chat do Trampo.', atual?.telefoneOculto);
  const ativo = marca('Perfil ativo na busca', 'Desligue para pausar sem apagar nada.', atual ? atual.disponivel !== false : true);
  const dias = h('div.atalhos', { style: { flexWrap: 'wrap' } });
  const pintarDias = () => dias.replaceChildren(...DIAS.map(([d, r]) => h('button.chip', {
    type: 'button', 'aria-pressed': String(st.diasSemana.has(d)),
    onclick: () => { st.diasSemana.has(d) ? st.diasSemana.delete(d) : st.diasSemana.add(d); pintarDias(); }
  }, r)));
  pintarDias();

  // ---------------------------------------------------------------- fotos dos trabalhos
  // Perfil que já existe grava na hora (a foto aparece no perfil sem precisar de "Salvar");
  // perfil novo junta tudo e grava ao publicar.
  const gravarFotos = () => novo ? Promise.resolve() :
    D.salvarPerfilProfissional({ fotos: st.fotos, antesDepois: st.antesDepois }).catch(x => toast(D.mensagemDeErro(x), 'erro'));
  const blocoFotos = h('div');
  const miniatura = (url, aoTirar, rot) => h('div.mini-foto', h('img', { src: url, alt: '', loading: 'lazy' }),
    rot ? h('span.mini-rot', rot) : null,
    h('button.mini-x', { type: 'button', 'aria-label': 'Tirar foto', onclick: aoTirar }, icone('x', 'pp')));
  const pintarFotos = () => {
    blocoFotos.replaceChildren(
      h('div.campo', h('label', 'Antes e depois'),
        h('div.ajuda', 'O que mais convence o cliente: a mesma foto antes e depois do seu serviço.'),
        st.antesDepois.length ? h('div.pares-mini', st.antesDepois.map((f, i) => h('div.par-mini',
          miniatura(f.url, () => tirarPar(i), 'Antes'), miniatura(f.urlDepois, () => tirarPar(i), 'Depois')))) : null,
        h('button.botao.sec.peq', { type: 'button', style: { width: 'fit-content' }, onclick: novoPar }, icone('mais', 'pp'), 'Adicionar antes e depois')),
      h('div.campo', h('label', 'Fotos de trabalhos feitos'),
        st.fotos.length ? h('div.grade-mini', st.fotos.map((f, i) => miniatura(f.url, () => tirarFoto(i)))) : null,
        h('label.botao.sec.peq', { style: { width: 'fit-content', cursor: 'pointer' } }, icone('mais', 'pp'), 'Adicionar fotos',
          h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: e => enviarVarias(e.target) }))));
  };
  async function enviarVarias(input) {
    const arquivos = [...input.files].slice(0, Math.max(0, 12 - st.fotos.length));
    input.value = '';
    if (!arquivos.length) { toast('Até 12 fotos de trabalhos.'); return; }
    toast(`Enviando ${arquivos.length} foto${arquivos.length > 1 ? 's' : ''}…`);
    let enviadas = 0;
    for (const a of arquivos) {
      try { st.fotos.push({ url: await D.enviarFoto(a), legenda: '', urlDepois: '' }); enviadas++; pintarFotos(); }
      catch (x) { toast(D.mensagemDeErro(x), 'erro'); }
    }
    if (enviadas) { await gravarFotos(); toast(enviadas > 1 ? 'Fotos adicionadas' : 'Foto adicionada', 'ok'); }
  }
  function tirarFoto(i) { const [f] = st.fotos.splice(i, 1); pintarFotos(); gravarFotos(); D.apagarFoto(f.url); }
  function tirarPar(i) { const [f] = st.antesDepois.splice(i, 1); pintarFotos(); gravarFotos(); D.apagarFoto(f.url); D.apagarFoto(f.urlDepois); }
  function novoPar() {
    folha(fechar => {
      const escolha = { antes: null, depois: null };
      const ok = h('button.botao', { type: 'button', disabled: true }, 'Adicionar');
      const slot = lado => {
        const prev = h('div.slot-prev', icone('mais'), h('span', lado === 'antes' ? 'Foto de ANTES' : 'Foto de DEPOIS'));
        return h('label.slot', prev, h('input', {
          type: 'file', accept: 'image/*', hidden: true, onchange: e => {
            const f = e.target.files[0]; if (!f) return;
            escolha[lado] = f;
            prev.replaceChildren(h('img', { src: URL.createObjectURL(f), alt: '' }), h('span.mini-rot', lado === 'antes' ? 'Antes' : 'Depois'));
            ok.disabled = !(escolha.antes && escolha.depois);
          }
        }));
      };
      const legenda = h('input', { placeholder: 'Ex.: pintura da sala, Pinheiros (opcional)', maxlength: 80 });
      ok.addEventListener('click', () => botaoCarregando(ok, (async () => {
        const [antes, depois] = await Promise.all([D.enviarFoto(escolha.antes), D.enviarFoto(escolha.depois)]);
        st.antesDepois.push({ url: antes, urlDepois: depois, legenda: legenda.value.trim() });
        pintarFotos(); await gravarFotos(); fechar(); toast('Antes e depois adicionado', 'ok');
      })().catch(x => toast(D.mensagemDeErro(x), 'erro'))));
      return [h('h2', 'Antes e depois'), h('p.sub', 'Use fotos do mesmo lugar e do mesmo ângulo. O cliente arrasta para comparar.'),
        h('div.slots', slot('antes'), slot('depois')), h('div.campo', { style: { marginTop: '12px' } }, legenda),
        h('div.acoes', h('button.botao.sec', { type: 'button', onclick: fechar }, 'Cancelar'), ok)];
    });
  }
  pintarFotos();

  const erro = h('div.erro');
  const salvar = h('button.botao.largo', {
    type: 'submit'
  }, novo ? 'Publicar meu perfil' : 'Salvar alterações');
  const form = h('form', {
    onsubmit: e => {
      e.preventDefault(); erro.textContent = '';
      if (!st.categoriaId) { erro.textContent = 'Escolha o serviço principal.'; filtro.focus(); return; }
      if (desc.value.trim().length < 30) { erro.textContent = 'Escreva pelo menos uma frase sobre o seu trabalho (30 letras).'; desc.focus(); return; }
      if (!cidade.value.trim()) { erro.textContent = 'Diga a cidade onde atende.'; cidade.focus(); return; }
      const fone = tel.value.replace(/\D/g, '');
      if (!oculto.i.checked && fone.length < 10) { erro.textContent = 'Informe um WhatsApp com DDD, ou marque "Esconder meu telefone".'; tel.focus(); return; }
      botaoCarregando(salvar, D.salvarPerfilProfissional({
        nome: u.nome, categoriaId: st.categoriaId, categoriasExtras: st.categoriasExtras,
        descricao: desc.value.trim(), anosExperiencia: Math.max(0, Math.min(60, +anos.value || 0)),
        bairro: bairro.value.trim(), cidade: cidade.value.trim(), estado: u.estado || '',
        telefone: fone, telefoneOculto: oculto.i.checked, genero: genero.value,
        precoVisita: Math.max(0, +visita.value || 0), precoHora: Math.max(0, +hora.value || 0),
        diasSemana: [...st.diasSemana].sort(), horaInicio: ini.value || '08:00', horaFim: fim.value || '18:00',
        urgencia24h: urg.i.checked, petFriendly: pet.i.checked, disponivel: ativo.i.checked,
        fotos: st.fotos, antesDepois: st.antesDepois,
      }).then(() => {
        toast(novo ? 'Perfil publicado! Você já aparece na busca.' : 'Perfil atualizado', 'ok');
        ir('/p/' + u.id, { substituir: true });
      }).catch(x => { erro.textContent = D.mensagemDeErro(x); }));
    }
  },
    h('div.cartao',
      h('h2.titulo-bloco', '1. O que você faz'),
      h('div.campo', h('label', 'Serviço principal e até 3 extras'), escolhida, h('div', { style: { marginTop: '10px' } }, filtro), listaCats),
      c('Sobre você e seu trabalho', desc, 'Sem telefone aqui: o contato é pelos botões do perfil.'),
      h('div.duas', c('Anos de experiência', anos), c('Gênero (opcional)', genero))),
    h('div.cartao',
      h('h2.titulo-bloco', '2. Onde e quando'),
      h('div.duas', c('Bairro', bairro), c('Cidade', cidade)),
      h('div.campo', h('label', 'Dias que atende'), dias),
      h('div.duas', c('Começa às', ini), c('Termina às', fim)),
      urg.el, pet.el),
    h('div.cartao',
      h('h2.titulo-bloco', '3. Preço de referência (opcional)'),
      h('p', { style: { margin: '0 0 12px', fontSize: '13.5px', color: 'var(--texto-2)' } }, 'Mostrar um valor de partida atrai mais clientes. O preço final é sempre combinado com o cliente.'),
      h('div.duas', c('Visita / orçamento', visita), c('Por hora', hora))),
    h('div.cartao',
      h('h2.titulo-bloco', '4. Fotos dos seus trabalhos'),
      h('p', { style: { margin: '0 0 12px', fontSize: '13.5px', color: 'var(--texto-2)' } }, 'Perfis com fotos recebem muito mais contatos. Foto do celular serve: o Trampo reduz o tamanho sozinho.'),
      blocoFotos),
    h('div.cartao',
      h('h2.titulo-bloco', '5. Contato'),
      c('WhatsApp', tel), oculto.el, ativo.el),
    h('div.honesto', h('span', '🤝'), h('div', h('b', 'Sem mensalidade, sem moeda, sem taxa por cliente.'),
      'Sua nota e sua taxa de resposta vêm só do que os clientes dizem depois de falar com você.')),
    h('div.funil-rodape', h('div', { style: { flex: 1 } }, erro, salvar)));

  return {
    titulo: novo ? 'Oferecer serviços' : 'Editar perfil',
    el: h('div',
      h('header.cabecalho',
        h('div.linha-topo', h('button.botao-redondo', { 'aria-label': 'Voltar', onclick: () => voltar('/perfil') }, icone('voltar')),
          h('div.cresce', h('div.sobre', 'Para profissionais'), h('h1', novo ? 'Ofereça seus serviços' : 'Seu perfil profissional'))),
        h('div.recado', { style: { marginTop: '8px' } }, novo ? 'Leva 2 minutos. Clientes da sua região te encontram pela busca e pelo mural.' : 'Mudanças aparecem na busca na hora.')),
      h('section.secao.form-prof', form)),
  };
}
