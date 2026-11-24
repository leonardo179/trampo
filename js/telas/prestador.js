import { h, icone, avatar, toast, nota1, reais, tempoAtras, visorDeImagem, folha, vazio, botaoCarregando } from '../ui.js';
import {
  categorias, categoriaSinc, taxaResposta, taxaPreco, taxaComparecimento, taxaRapidez, tempoMedio,
  atendeAgora, ausente, botaoFavorito, estrelas, distanciaKm, kmTexto,
} from '../componentes.js';
import { voltar } from '../app.js';
import { portfolio } from '../galeria.js';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default async function telaPrestador({ D, args, ir }) {
  await categorias();
  const p = await D.prestador(args[0]);
  if (!p) return h('div', h('div.secao', vazio('🔍', 'Perfil não encontrado', 'Esse profissional saiu do Trampo ou o link está errado.', h('a.botao', { href: '#/' }, 'Voltar ao início'))));
  D.registrarVisita(p.id);
  const u = D.estado.usuario;
  const cat = categoriaSinc(p.categoriaId);
  const extras = (p.categoriasExtras || []).map(categoriaSinc);
  const dist = distanciaKm(u.lat, u.lng, p.lat, p.lng);
  const ehMeu = u.id === p.id;

  // ---------------------------------------------------------------- contato (WhatsApp / ligar / conversa)
  const telefone = (p.telefone || '').replace(/\D/g, '');
  async function contatar(canal) {
    if (D.estado.visitante) {
      folha(f => [h('h2', 'Crie sua conta para chamar'), h('p.sub', 'É grátis e leva meio minuto. Assim o profissional sabe quem está chamando e você pode avaliar depois.'),
        h('div.acoes', h('button.botao.sec', { onclick: () => { f(); ir('/entrar'); } }, 'Já tenho conta'), h('button.botao', { onclick: () => { f(); ir('/entrar?modo=cadastro'); } }, 'Criar conta')), h('button.link', { style: { display: 'block', margin: '14px auto 0' }, onclick: f }, 'Agora não')]);
      return;
    }
    if (canal === 'CHAT') {
      try { const id = await D.abrirConversa(p, cat.nome); ir('/conversa/' + id); }
      catch (x) { toast(D.mensagemDeErro(x), 'erro'); }
      return;
    }
    D.registrarContato(p, canal).catch(() => {});
    const numero = telefone.startsWith('55') ? telefone : '55' + telefone;
    if (canal === 'WHATSAPP') {
      const msg = `Olá, ${p.nome.split(' ')[0]}! Te achei no Trampo. Preciso de ${cat.nome.toLowerCase()}.`;
      window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    } else location.href = `tel:+${numero}`;
  }
  const podeTelefone = telefone.length >= 10 && !p.telefoneOculto;
  // A conversa pelo Trampo vem primeiro: fica registrado o combinado e o app mede sozinho quem
  // responde e em quanto tempo. O WhatsApp continua lá, como opção secundária.
  const botoesContato = (cls = '', compacto = false) => [
    h('button.botao', { class: cls, onclick: () => contatar('CHAT') }, icone('chat', 'p'), 'Conversar pelo Trampo'),
    podeTelefone ? h('button.botao.zap-sec', { class: compacto ? '' : cls, 'aria-label': 'Chamar no WhatsApp', onclick: () => contatar('WHATSAPP') },
      icone('zap', 'p'), compacto ? null : 'WhatsApp') : null,
  ];

  // ---------------------------------------------------------------- números
  const tr = taxaResposta(p), tp = taxaPreco(p), tc = taxaComparecimento(p), rap = taxaRapidez(p), tm = tempoMedio(p);
  const metricas = [
    p.totalAvaliacoes ? [nota1(p.notaMedia), `${p.totalAvaliacoes} avaliações`, false] : ['Novo', 'sem avaliações ainda', false],
    tr != null ? [`${tr}%`, 'responde quem chama', true] : null,
    tp != null ? [`${tp}%`, 'preço igual ao combinado', false] : tc != null ? [`${tc}%`, 'compareceu no combinado', false] : null,
    tm != null && !tp ? [tm < 60 ? `${tm} min` : `${Math.round(tm / 60)} h`, 'tempo de resposta', false] : null,
    p.anosExperiencia ? [String(p.anosExperiencia), p.anosExperiencia === 1 ? 'ano de experiência' : 'anos de experiência', false] : null,
  ].filter(Boolean).slice(0, 3);

  const selos = Object.entries(p.selos || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const topo = h('div.detalhe-topo',
    p.capaUrl ? h('img.capa', { src: p.capaUrl, alt: '', loading: 'lazy' }) : null,
    h('div.barra',
      h('button.botao-redondo', { 'aria-label': 'Voltar', onclick: () => voltar('/') }, icone('voltar')),
      h('div', { style: { display: 'flex', gap: '8px' } },
        h('button.botao-redondo', {
          'aria-label': 'Compartilhar', onclick: async () => {
            const url = location.href;
            try {
              if (navigator.share) await navigator.share({ title: p.nome, text: `${p.nome} — ${cat.nome} no Trampo`, url });
              else { await navigator.clipboard.writeText(url); toast('Link copiado', 'ok'); }
            } catch { }
          }
        }, icone('compartilhar', 'p')),
        ehMeu ? null : botaoFavorito(D, p, 'botao-redondo'))));

  const principal = h('div', { style: { display: 'grid', gap: '12px' } },
    h('div.cartao', { style: { paddingTop: '0' } },
      h('div', { style: { marginTop: '-44px' } }, avatar(p.nome, p.fotoUrl, 'g', atendeAgora(p), p.id)),
      h('h1', p.nome, p.verificado ? h('span', { style: { color: 'var(--violeta)' }, title: 'Documento verificado' }, icone('verif')) : null),
      h('div.oque', [cat.nome, ...extras.map(e => e.nome)].join(' · ')),
      h('div.oque', { style: { display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' } }, icone('local', 'pp'),
        [p.bairro, p.cidade && `${p.cidade}${p.estado ? '/' + p.estado : ''}`, kmTexto(dist) && `a ${kmTexto(dist)}`].filter(Boolean).join(' · ')),
      ausente(p) ? h('div.honesto', { style: { marginTop: '12px', background: 'color-mix(in srgb, var(--alerta) 14%, var(--superficie))', color: 'inherit' } },
        h('span', '⏸️'), h('div', h('b', 'Ausente por um tempo'), p.mensagemAusente || 'Pode demorar a responder.')) : null,
      h('div.metricas', metricas.map(([v, r, dest]) => h('div.metrica', { class: dest ? 'dest' : '' }, h('b', v), h('span', r)))),
      h('div.selos',
        p.verificado ? h('span.selo.cor', icone('escudo', 'pp'), 'Verificado') : null,
        p.urgencia24h ? h('span.selo', icone('raio', 'pp'), 'Urgência 24h') : null,
        p.petFriendly ? h('span.selo', icone('pata', 'pp'), 'Aceita pet') : null,
        p.cnpj ? h('span.selo', icone('maleta', 'pp'), 'Tem CNPJ') : null,
        p.nr10 ? h('span.selo', 'NR-10') : null,
        rap != null ? h('span.selo', icone('relogio', 'pp'), `${rap}% acham a resposta rápida`) : null,
        atendeAgora(p) ? h('span.selo', { style: { color: 'var(--sucesso)' } }, '● Ativo agora') : null)),

    p.descricao ? h('div.cartao', h('h2', { style: { fontSize: '16px', margin: '0 0 8px' } }, 'Sobre'), h('p.texto-longo', p.descricao)) : null,

    portfolio(p),
    h('div', { id: 'avaliacoes' }),
    h('div', { id: 'perguntas' }));

  const precoBloco = (p.precoVisita > 0 || p.precoHora > 0)
    ? h('div', { style: { marginBottom: '12px' } },
      p.precoVisita > 0 ? h('div.preco', reais(p.precoVisita), h('small', ' a visita')) : null,
      p.precoHora > 0 ? h('div.preco', { style: p.precoVisita > 0 ? { fontSize: '16px' } : null }, reais(p.precoHora), h('small', ' por hora')) : null,
      h('div', { style: { fontSize: '12.5px', color: 'var(--texto-3)', marginTop: '2px' } }, 'Preço de referência. O valor final é combinado entre vocês.'))
    : h('div', { style: { fontSize: '13.5px', color: 'var(--texto-2)', marginBottom: '12px' } }, 'Preço combinado na conversa, conforme o serviço.');

  const lado = h('aside.lado',
    h('div.cartao',
      precoBloco,
      ehMeu ? h('div', { style: { display: 'grid', gap: '10px' } },
        h('div.honesto', h('span', '👤'), h('div', h('b', 'Este é o seu perfil'), 'É assim que os clientes veem você.')),
        !D.apareceNaBusca(p) ? h('div.honesto', { style: { background: 'color-mix(in srgb, var(--perigo) 12%, var(--superficie))', color: 'inherit' } },
          h('span', '📱'), h('div', h('b', 'Ainda não aparece na busca'), 'Confirme seu telefone por SMS no seu perfil profissional.')) : null,
        h('a.botao.sec.largo', { href: '#/profissional' }, 'Editar perfil profissional'))
        : h('div', { style: { display: 'grid', gap: '8px' } }, h('div.so-pc.grade', botoesContato('largo'), h('div.nota-chat', 'Pelo Trampo fica registrado o que vocês combinarem.')), h('div#avaliar-slot')),
      h('div', { style: { marginTop: '14px' } },
        h('div.info-linha', icone('calendario', 'p'),
          (p.diasSemana || [1, 2, 3, 4, 5]).sort().map(d => DIAS[d % 7]).join(', ') + ` · ${p.horaInicio || '08:00'}–${p.horaFim || '18:00'}`),
        p.janelaChegadaMin ? h('div.info-linha', icone('relogio', 'p'), `Chega dentro de uma janela de ${p.janelaChegadaMin} min`) : null,
        h('div.info-linha', icone('escudo', 'p'), 'Contato grátis. Nunca pague adiantado fora do combinado.'))),
    h('div.cartao.so-pc', { style: { fontSize: '13px', color: 'var(--texto-2)' } },
      h('b', { style: { color: 'var(--texto)' } }, 'Como funciona a taxa de resposta'), h('br'),
      'Depois de cada contato, perguntamos ao cliente se o profissional respondeu. O número sai dessas respostas, não do que o profissional diz.'));

  const barraCel = ehMeu ? null : h('div.barra-acao', botoesContato('', true));

  const el = h('div', topo, h('div.detalhe', principal, lado), barraCel,
    h('div.so-cel', { style: { height: '80px' } }));

  // Já chamou e passou uma hora: o botão de avaliar aparece aqui também (além do Início).
  if (!ehMeu) D.meuContatoCom(p.id).then(async c => {
    const slot = el.querySelector('#avaliar-slot');
    if (!c || c.avaliado || !slot) return;
    const { podeAvaliar } = await import('../reputacao.js');
    if (podeAvaliar(c, Date.now())) slot.replaceWith(h('a.botao.contorno.largo', { href: `#/avaliar/${p.id}` }, icone('estrela', 'p'), `Avaliar ${p.nome.split(' ')[0]}`));
  });

  // ---------------------------------------------------------------- avaliações (carregam depois)
  D.avaliacoesDe(p.id).then(avs => {
    const alvo = el.querySelector('#avaliacoes');
    const visiveis = avs.filter(a => !a.denunciada);
    if (!visiveis.length) return;
    const dist5 = p.distribuicao?.length === 5 ? p.distribuicao : [1, 2, 3, 4, 5].map(n => visiveis.filter(a => a.nota === n).length);
    const total = dist5.reduce((a, b) => a + b, 0) || 1;
    let mostrar = 5;
    const lista = h('div');
    const maisBotao = h('button.botao.sec.largo', { style: { marginTop: '10px' } }, 'Ver mais avaliações');
    const pintar = () => {
      lista.replaceChildren(...visiveis.slice(0, mostrar).map(a => h('div.aval',
        h('div.topo', h('b', (a.clienteNome || 'Cliente').split(' ')[0]), h('span', { style: { color: 'var(--texto-3)' } }, tempoAtras(a.criadoEm))),
        h('div.estrelas', { 'aria-label': `${a.nota} estrelas` }, estrelas(a.nota)),
        a.comentario ? h('p', a.comentario) : null,
        a.suspeita ? h('div', { style: { fontSize: '12px', color: 'var(--alerta)', marginTop: '4px' } }, 'Em análise pela moderação') : null,
        a.resposta ? h('div.resp', h('b', 'Resposta do profissional: '), a.resposta) : null)));
      maisBotao.hidden = mostrar >= visiveis.length;
    };
    maisBotao.onclick = () => { mostrar += 10; pintar(); };
    pintar();
    alvo.replaceWith(h('div.cartao',
      h('div', { style: { display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '8px' } },
        h('div', { style: { textAlign: 'center' } },
          h('div', { style: { fontSize: '36px', fontWeight: 800, lineHeight: 1 } }, nota1(p.notaMedia || 0)),
          h('div.estrelas', { style: { color: '#F5B301' } }, estrelas(p.notaMedia || 0)),
          h('div', { style: { fontSize: '12px', color: 'var(--texto-3)' } }, `${p.totalAvaliacoes || visiveis.length} avaliações`)),
        h('div.barras', { style: { flex: 1 } }, [5, 4, 3, 2, 1].map(n => h('div.barra-nota', h('span', n),
          h('div.trilho', h('div.enche', { style: { width: `${(dist5[n - 1] / total) * 100}%` } })), h('span', dist5[n - 1]))))),
      selos.length ? h('div.selos', { style: { marginBottom: '6px' } }, selos.map(([s, n]) => h('span.selo', `${s} · ${n}`))) : null,
      h('div', { style: { fontSize: '12px', color: 'var(--texto-3)' } }, 'Só avalia quem chamou o profissional pelo Trampo. Notas antigas pesam menos.'),
      lista, maisBotao));
  }).catch(() => {});

  D.perguntasDe(p.id).then(ps => {
    const alvo = el.querySelector('#perguntas');
    const resp = ps.filter(q => q.resposta);
    if (!resp.length) return;
    alvo.replaceWith(h('div.cartao', h('h2', { style: { fontSize: '16px', margin: '0 0 4px' } }, 'Perguntas respondidas'),
      resp.slice(0, 6).map(q => h('div.aval', h('div', { style: { fontWeight: 650, fontSize: '14px' } }, q.texto), h('p', q.resposta)))));
  });

  return { el, titulo: p.nome };
}
