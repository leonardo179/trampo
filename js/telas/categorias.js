import { h, icone } from '../ui.js';
import { categorias } from '../componentes.js';
import { voltar } from '../app.js';

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default async function telaCategorias() {
  const cats = [...(await categorias()).values()];
  const grupos = [...new Set(cats.map(c => c.g))];
  const filtro = h('input', { type: 'search', placeholder: 'Filtrar categorias', 'aria-label': 'Filtrar categorias' });
  const corpo = h('div');

  function pintar() {
    const q = norm(filtro.value.trim());
    corpo.replaceChildren(...grupos.map(g => {
      const doGrupo = cats.filter(c => c.g === g && (!q || norm(c.nome).includes(q)));
      if (!doGrupo.length) return '';
      return h('section.secao',
        h('div.secao-titulo', h('h2', g), h('span.conta', doGrupo.length)),
        h('div.grade-cat', doGrupo.map(c => h('a.cat', { href: `#/?c=${c.id}`, title: c.nome }, h('span.emo', c.e), h('span.rot', c.nome)))));
    }));
  }
  filtro.addEventListener('input', pintar);
  pintar();

  return {
    titulo: 'Categorias',
    el: h('div',
      h('header.cabecalho',
        h('div.linha-topo', h('button.botao-redondo', { 'aria-label': 'Voltar', onclick: () => voltar('/') }, icone('voltar')),
          h('div.cresce', h('div.sobre', `${cats.length} serviços`), h('h1', 'Todas as categorias'))),
        h('div.campo-frase', icone('lupa', 'p'), filtro)),
      corpo),
  };
}
