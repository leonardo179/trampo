import { h, esqueletos, vazio } from '../ui.js';
import { categorias, cartaoPrestador } from '../componentes.js';

export default async function telaFavoritos({ D, ir }) {
  await categorias();
  const corpo = h('section.secao', esqueletos(2));
  const el = h('div',
    h('header.cabecalho', h('div.sobre', 'Seus profissionais'), h('h1', 'Favoritos'),
      h('div.recado', 'Quem você salvou para chamar de novo.')),
    corpo);

  function pintar() {
    if (D.estado.visitante) {
      corpo.replaceChildren(vazio('💜', 'Salve quem você gostou', 'Crie sua conta para guardar profissionais e chamar de novo com um toque.',
        h('button.botao', { onclick: () => ir('/entrar?modo=cadastro') }, 'Criar conta grátis')));
      return;
    }
    const ids = [...D.estado.favoritos];
    if (!ids.length) {
      corpo.replaceChildren(vazio('💜', 'Nenhum favorito ainda', 'Toque no coração de um profissional para guardar aqui.',
        h('a.botao', { href: '#/' }, 'Procurar profissionais')));
      return;
    }
    Promise.all(ids.map(id => D.prestador(id).catch(() => null))).then(lista => {
      const ok = lista.filter(Boolean);
      corpo.replaceChildren(
        h('div.secao-titulo', h('h2', `${ok.length} salvo${ok.length === 1 ? '' : 's'}`)),
        h('div.lista.grade-2', ok.map(p => cartaoPrestador(D, p))));
    });
  }
  pintar();
  // Desfavoritar aqui mesmo tira o cartão da lista.
  let antes = D.estado.favoritos.size;
  const parar = D.aoMudar(est => { if (est.favoritos.size !== antes) { antes = est.favoritos.size; pintar(); } });
  return { el, titulo: 'Favoritos', limpar: parar };
}
