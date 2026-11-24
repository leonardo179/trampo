// Acesso ao Firebase (mesmo projeto e mesmas regras do app Android: trampo-bc061).
// Espelha o RepositorioFirebase.kt — mesmos nomes de coleção e de campo.
const V = '13.4.0';
const B = `https://www.gstatic.com/firebasejs/${V}`;
const [{ initializeApp }, A, F] = await Promise.all([
  import(`${B}/firebase-app.js`),
  import(`${B}/firebase-auth.js`),
  import(`${B}/firebase-firestore.js`),
]);

const app = initializeApp({
  apiKey: 'AIzaSyCCFUnsjmTOESefSPJsRUjoMeH-oUCKPXw',
  authDomain: 'trampo-bc061.firebaseapp.com',
  projectId: 'trampo-bc061',
  storageBucket: 'trampo-bc061.firebasestorage.app',
  messagingSenderId: '471784701420',
  appId: '1:471784701420:web:6ac940258bedc1a473d4c9',
});
const auth = A.getAuth(app);
let db;
try {
  // Cache no IndexedDB: a segunda visita abre com a vitrine já na memória, e várias abas
  // dividem o mesmo cache.
  db = F.initializeFirestore(app, {
    localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
  });
} catch { db = F.getFirestore(app); }

const { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, limit, onSnapshot, increment, orderBy, limitToLast } = F;
const col = n => collection(db, n);

// ------------------------------------------------------------------ estado
const ouvintes = new Set();
export const estado = {
  usuario: null,       // documento de usuarios/ (ou {id, nome:'Visitante'})
  visitante: false,
  favoritos: new Set(),
  pronto: false,
};
export function aoMudar(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }
function avisar() { ouvintes.forEach(f => f(estado)); }

export const uid = () => auth.currentUser?.uid || null;

// ------------------------------------------------------------------ conta
const ERROS = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'Não existe conta com esse e-mail.',
  'auth/invalid-email': 'Esse e-mail não parece válido.',
  'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Tente entrar.',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Espere um pouco e tente de novo.',
  'auth/network-request-failed': 'Sem conexão. Confira a internet.',
  'permission-denied': 'Sem permissão para isso.',
};
export function mensagemDeErro(e) {
  return ERROS[e?.code] || e?.message?.replace(/^Firebase: /, '') || 'Algo deu errado. Tente de novo.';
}

async function carregarUsuario(id) {
  const s = await getDoc(doc(db, 'usuarios', id));
  return s.exists() ? s.data() : null;
}
async function carregarFavoritos() {
  const id = uid(); if (!id) return;
  try {
    const s = await getDocs(collection(db, 'usuarios', id, 'favoritos'));
    estado.favoritos = new Set(s.docs.map(d => d.id));
  } catch { estado.favoritos = new Set(); }
}

/** Resolve quando a sessão inicial é conhecida (logado, visitante ou fora). */
export const sessaoPronta = new Promise(res => {
  const parar = A.onAuthStateChanged(auth, async u => {
    parar();
    try {
      if (u?.isAnonymous) {
        estado.usuario = { id: u.uid, nome: 'Visitante' }; estado.visitante = true;
      } else if (u) {
        estado.usuario = await carregarUsuario(u.uid);
        if (estado.usuario?.banido) { await A.signOut(auth); estado.usuario = null; }
        else if (estado.usuario) carregarFavoritos().then(avisar);
      }
    } catch { /* sem rede na abertura: segue como deslogado e a tela de acesso tenta de novo */ }
    estado.pronto = true; avisar(); res(estado);
  });
});

export async function entrar(email, senha) {
  await A.signInWithEmailAndPassword(auth, email.trim(), senha);
  const u = await carregarUsuario(auth.currentUser.uid);
  if (!u) { await A.signOut(auth); throw new Error('Conta sem cadastro. Refaça o cadastro.'); }
  if (u.banido) { await A.signOut(auth); throw new Error('Esta conta está bloqueada.'); }
  estado.usuario = u; estado.visitante = false;
  await carregarFavoritos();
  avisar();
  return u;
}

export async function cadastrar(dados, senha, categoriaInicial = null) {
  const atual = auth.currentUser;
  let cred;
  // Visitante que resolve se cadastrar: a conta anônima vira a conta de verdade (mesmo id).
  if (atual?.isAnonymous) {
    cred = await A.linkWithCredential(atual, A.EmailAuthProvider.credential(dados.email.trim(), senha));
  } else {
    cred = await A.createUserWithEmailAndPassword(auth, dados.email.trim(), senha);
  }
  const id = cred.user.uid;
  const agora = Date.now();
  const u = {
    id, nome: dados.nome.trim(), email: dados.email.trim().toLowerCase(), telefone: dados.telefone || '',
    cidade: dados.cidade || '', estado: dados.estado || '', bairro: dados.bairro || '',
    lat: null, lng: null, fotoUrl: '', ehPrestador: categoriaInicial != null, admin: false,
    suspenso: false, banido: false, aparelho: 'web', criadoEm: agora,
    termosVersao: 1, termosAceitosEm: agora, telefoneConfirmado: false,
  };
  await setDoc(doc(db, 'usuarios', id), u);
  estado.usuario = u; estado.visitante = false;
  avisar();
  return u;
}

export async function entrarComoVisitante() {
  const atual = auth.currentUser;
  const id = atual?.isAnonymous ? atual.uid : (await A.signInAnonymously(auth)).user.uid;
  estado.usuario = { id, nome: 'Visitante' }; estado.visitante = true; estado.favoritos = new Set();
  avisar();
}

export const recuperarSenha = email => A.sendPasswordResetEmail(auth, email.trim());

export async function sair() {
  await A.signOut(auth);
  estado.usuario = null; estado.visitante = false; estado.favoritos = new Set();
  cachePrestadores = null;
  avisar();
}

export async function salvarUsuario(campos) {
  const id = uid();
  await updateDoc(doc(db, 'usuarios', id), campos);
  estado.usuario = { ...estado.usuario, ...campos };
  avisar();
}

// ------------------------------------------------------------------ vitrine
let cachePrestadores = null;
/**
 * A vitrine inteira de uma vez (a base cabe folgada: o app Android pede limit 300 por busca).
 * Uma leitura só, e toda a filtragem acontece no navegador — busca instantânea a cada tecla.
 */
export function prestadores() {
  if (!cachePrestadores) {
    cachePrestadores = getDocs(query(col('prestadores'), where('disponivel', '==', true), limit(400)))
      .then(s => s.docs.map(d => ({ id: d.id, ...d.data() })))
      .catch(e => { cachePrestadores = null; throw e; });
  }
  return cachePrestadores;
}

export async function prestador(id) {
  const lista = cachePrestadores ? await cachePrestadores.catch(() => []) : [];
  const achado = lista.find(p => p.id === id);
  if (achado) return achado;
  const s = await getDoc(doc(db, 'prestadores', id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

const visitados = new Set();
export function registrarVisita(id) {
  const eu = uid();
  if (!eu || id === eu || visitados.has(id)) return;
  visitados.add(id);
  updateDoc(doc(db, 'prestadores', id), { visualizacoes: increment(1) }).catch(() => {});
}

export async function avaliacoesDe(prestadorId) {
  const s = await getDocs(query(col('avaliacoes'), where('prestadorId', '==', prestadorId), limit(200)));
  return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.criadoEm - a.criadoEm);
}

export async function perguntasDe(prestadorId) {
  try {
    const s = await getDocs(query(col('perguntas'), where('prestadorId', '==', prestadorId), limit(60)));
    return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.criadoEm - a.criadoEm);
  } catch { return []; }
}

export async function favoritar(prestadorId, marcar) {
  const id = uid(); if (!id || estado.visitante) throw new Error('Crie sua conta para salvar favoritos.');
  const ref = doc(db, 'usuarios', id, 'favoritos', prestadorId);
  if (marcar) { estado.favoritos.add(prestadorId); avisar(); await setDoc(ref, { em: Date.now() }); }
  else { estado.favoritos.delete(prestadorId); avisar(); await deleteDoc(ref); }
}

/** Mesmo registro do app: libera a avaliação depois e alimenta a taxa de resposta. */
export async function registrarContato(p, canal) {
  const id = uid(); if (!id) throw new Error('Entre na sua conta');
  const chave = `${id}_${p.id}`;
  const ref = doc(db, 'contatos', chave);
  const existe = await getDoc(ref);
  if (!existe.exists()) {
    await setDoc(ref, {
      id: chave, clienteId: id, prestadorId: p.id, canal, criadoEm: Date.now(),
      respondeu: null, respondeuRapido: false, compareceu: null, precoCumpriu: null, avaliado: false,
    });
  }
  const campos = { contatosRecebidos: increment(1) };
  if (canal === 'WHATSAPP') campos.cliquesZap = increment(1);
  if (canal === 'LIGACAO') campos.cliquesLigar = increment(1);
  updateDoc(doc(db, 'prestadores', p.id), campos).catch(() => {});
}

// ------------------------------------------------------------------ mural
export function ouvirMural(fn, erro) {
  return onSnapshot(query(col('pedidos'), where('encerrado', '==', false), limit(200)),
    s => fn(s.docs.map(d => ({ id: d.id, ...d.data() }))), erro);
}
export function ouvirMeusPedidos(fn) {
  const id = uid(); if (!id) { fn([]); return () => {}; }
  return onSnapshot(query(col('pedidos'), where('clienteId', '==', id)),
    s => fn(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.criadoEm - a.criadoEm)), () => fn([]));
}

export async function publicarPedido(p) {
  const u = estado.usuario;
  if (!u || estado.visitante) throw new Error('Crie sua conta para publicar.');
  const ref = doc(col('pedidos'));
  let anteriores = [];
  try { anteriores = (await getDocs(query(col('pedidos'), where('clienteId', '==', u.id)))).docs.map(d => d.data()); } catch {}
  const novo = {
    lat: null, lng: null, orcamentoAte: 0, interessados: 0, escolhidoId: '', escolhidoNome: '',
    concluidoEm: 0, fotos: [], videoUrl: '', estado: u.estado || '',
    ...p,
    id: ref.id, clienteId: u.id, clienteNome: u.nome,
    clientePedidosAntes: anteriores.length,
    clienteFechadosAntes: anteriores.filter(x => x.encerrado).length,
    // Telefone só vai no documento se a pessoa aceitou ser chamada direto (igual ao app).
    clienteTelefone: p.podemChamarDireto ? (u.telefone || '') : '',
    criadoEm: Date.now(), encerrado: false,
  };
  await setDoc(ref, novo);
  return ref.id;
}

export const encerrarPedido = id => updateDoc(doc(db, 'pedidos', id), { encerrado: true });

export async function interessadosDoPedido(pedidoId) {
  const s = await getDocs(query(col('interesses'), where('pedidoId', '==', pedidoId), limit(30)));
  const props = s.docs.map(d => d.data());
  const lista = await Promise.all(props.map(async i => ({ interesse: i, prestador: await prestador(i.prestadorId) })));
  return lista.filter(x => x.prestador);
}

export async function demonstrarInteresse(pedido, proposta = {}) {
  const id = uid();
  if (!id || estado.visitante) throw new Error('Entre na sua conta');
  if (pedido.clienteId === id) throw new Error('Este pedido é seu.');
  const chave = `${pedido.id}_${id}`;
  if ((await getDoc(doc(db, 'interesses', chave))).exists()) return;
  const atual = (await getDoc(doc(db, 'pedidos', pedido.id))).data() || pedido;
  if (atual.encerrado) throw new Error('Esse pedido já foi encerrado.');
  if ((atual.interessados || 0) >= 5) throw new Error('Esse pedido já tem 5 profissionais. O cliente está escolhendo.');
  await setDoc(doc(db, 'interesses', chave), {
    id: chave, pedidoId: pedido.id, prestadorId: id, criadoEm: Date.now(),
    precoDe: proposta.precoDe || 0, precoAte: proposta.precoAte || 0, prazo: proposta.prazo || '',
  });
  await updateDoc(doc(db, 'pedidos', pedido.id), { interessados: increment(1) });
}

// ------------------------------------------------------------------ conversas
export function ouvirConversas(fn) {
  const id = uid(); if (!id) { fn([]); return () => {}; }
  return onSnapshot(query(col('conversas'), where('participantes', 'array-contains', id), limit(200)),
    s => fn(s.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => Math.max(b.ultimaEm || 0, b.criadoEm || 0) - Math.max(a.ultimaEm || 0, a.criadoEm || 0))),
    () => fn([]));
}

export function ouvirMensagens(conversaId, fn) {
  return onSnapshot(query(collection(db, 'conversas', conversaId, 'mensagens'), orderBy('criadoEm', 'asc'), limitToLast(300)),
    s => fn(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => fn([]));
}

export async function conversa(id) {
  const s = await getDoc(doc(db, 'conversas', id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function abrirConversa(prestador, assunto = '') {
  const u = estado.usuario;
  if (!u || estado.visitante) throw new Error('Crie sua conta para conversar.');
  if (u.id === prestador.id) throw new Error('Esse perfil é seu.');
  const id = `${u.id}_${prestador.id}`;
  const ref = doc(db, 'conversas', id);
  const existe = (await getDoc(ref)).exists();
  if (!existe) {
    await setDoc(ref, {
      id, participantes: [u.id, prestador.id], clienteId: u.id, clienteNome: u.nome,
      prestadorId: prestador.id, prestadorNome: prestador.nome, assunto,
      ultimaMensagem: '', ultimoAutor: '', ultimaEm: 0, naoLidasCliente: 0, naoLidasPrestador: 0,
      lidaClienteEm: 0, lidaPrestadorEm: 0, primeiraClienteEm: 0, respondidaEm: 0,
      tempoContado: false, criadoEm: Date.now(),
    });
  } else if (assunto) updateDoc(ref, { assunto }).catch(() => {});
  return id;
}

export async function enviarMensagem(conversaId, texto) {
  const eu = uid();
  const t = texto.trim().slice(0, 2000);
  if (!t) return;
  const ref = doc(db, 'conversas', conversaId);
  const c = (await getDoc(ref)).data();
  if (!c) throw new Error('Conversa não encontrada');
  const agora = Date.now();
  const m = doc(collection(db, 'conversas', conversaId, 'mensagens'));
  await setDoc(m, { id: m.id, conversaId, autorId: eu, texto: t, fotoUrl: '', tipo: 'TEXTO', criadoEm: agora, valor: 0, prazo: '', garantiaDias: 0, refId: '' });
  const souPrest = c.prestadorId === eu;
  await updateDoc(ref, {
    ultimaMensagem: t.replace(/\n/g, ' ').slice(0, 140), ultimoAutor: eu, ultimaEm: agora,
    [souPrest ? 'naoLidasCliente' : 'naoLidasPrestador']: increment(1),
    [souPrest ? 'lidaPrestadorEm' : 'lidaClienteEm']: agora,
  });
  const marco = !souPrest && !c.primeiraClienteEm ? 'primeiraClienteEm'
    : souPrest && !c.respondidaEm && c.primeiraClienteEm ? 'respondidaEm' : null;
  if (marco) updateDoc(ref, { [marco]: agora }).catch(() => {});
  const naoLidasDoOutro = souPrest ? c.naoLidasCliente : c.naoLidasPrestador;
  if (!naoLidasDoOutro) {
    const meuNome = (souPrest ? c.prestadorNome : c.clienteNome) || '';
    setDoc(doc(col('avisos')), {
      usuarioId: souPrest ? c.clienteId : c.prestadorId, tipo: 'MENSAGEM',
      titulo: 'Nova mensagem' + (meuNome ? ' de ' + meuNome.split(' ')[0] : ''),
      texto: t.slice(0, 140), alvoId: conversaId, criadoEm: agora, lido: false,
    }).catch(() => {});
  }
}

export async function marcarConversaLida(c) {
  const eu = uid();
  const souPrest = c.prestadorId === eu;
  const nao = souPrest ? c.naoLidasPrestador : c.naoLidasCliente;
  if (!nao) return;
  updateDoc(doc(db, 'conversas', c.id), {
    [souPrest ? 'naoLidasPrestador' : 'naoLidasCliente']: 0,
    [souPrest ? 'lidaPrestadorEm' : 'lidaClienteEm']: Date.now(),
  }).catch(() => {});
}

export async function meuPerfilProfissional() {
  const id = uid(); if (!id) return null;
  try { const s = await getDoc(doc(db, 'prestadores', id)); return s.exists() ? { id, ...s.data() } : null; }
  catch { return null; }
}

// ------------------------------------------------------------------ depois do contato
// As perguntas de dois botões ("ele respondeu?", "apareceu?", "o preço foi o combinado?") e a
// avaliação. Mesmas escritas do RepositorioFirebase.kt: cada contador sobe de 1 numa escrita
// própria, porque a regra do Firestore só aceita contador que sobe exatamente um por vez.
export function ouvirContatos(fn) {
  const id = uid(); if (!id || estado.visitante) { fn([]); return () => {}; }
  return onSnapshot(query(col('contatos'), where('clienteId', '==', id)),
    s => fn(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.criadoEm - a.criadoEm)), () => fn([]));
}

const sobe = (prestadorId, campo) => updateDoc(doc(db, 'prestadores', prestadorId), { [campo]: increment(1) });

export async function confirmarResposta(c, respondeu, rapido = false) {
  await updateDoc(doc(db, 'contatos', c.id), { respondeu, respondeuRapido: respondeu && rapido });
  if (!respondeu) return;
  await sobe(c.prestadorId, 'contatosRespondidos');
  await sobe(c.prestadorId, 'respostasAvaliadas');
  if (rapido) await sobe(c.prestadorId, 'respondeuRapido');
}

export async function confirmarComparecimento(c, compareceu) {
  await updateDoc(doc(db, 'contatos', c.id), { compareceu });
  await sobe(c.prestadorId, 'combinados');
  if (compareceu) await sobe(c.prestadorId, 'compareceu');
}

export async function confirmarPreco(c, cumpriu) {
  await updateDoc(doc(db, 'contatos', c.id), { precoCumpriu: cumpriu });
  await sobe(c.prestadorId, 'precosAvaliados');
  if (cumpriu) await sobe(c.prestadorId, 'precoCumprido');
}

export async function avaliar(prestadorId, nota, comentario) {
  const R = await import('./reputacao.js');
  const u = estado.usuario;
  if (!u || estado.visitante) throw new Error('Entre na sua conta');
  const chave = `${u.id}_${prestadorId}`;
  const contato = (await getDoc(doc(db, 'contatos', chave))).data();
  if (!contato) throw new Error('Só quem chamou o profissional pode avaliar.');
  if (!R.podeAvaliar(contato, Date.now())) throw new Error('Aguarde uma hora depois do contato para avaliar.');
  const anteriores = (await getDocs(query(col('avaliacoes'), where('prestadorId', '==', prestadorId)))).docs.map(d => d.data());
  const nova = {
    id: chave, clienteId: u.id, clienteNome: u.nome, prestadorId, nota, comentario: comentario.trim().slice(0, 1000),
    criadoEm: Date.now(), denunciada: false, motivoDenuncia: '', suspeita: false, motivoSuspeita: '', resposta: '', fotos: [],
  };
  // Mesmo aparelho: na web não há identificador de aparelho, então conta como 0 (igual a conta sem aparelho no app).
  const suspeita = R.analisar(nova, u, anteriores, 0);
  nova.suspeita = !!suspeita; nova.motivoSuspeita = suspeita?.motivo || '';
  await setDoc(doc(db, 'avaliacoes', chave), nova);
  await updateDoc(doc(db, 'contatos', chave), { avaliado: true });
  const todas = [...anteriores.filter(a => a.id !== chave), nova];
  await updateDoc(doc(db, 'prestadores', prestadorId), R.camposDoPrestador(todas));
  cachePrestadores = null; // a vitrine relê com a nota nova
}

// ------------------------------------------------------------------ perfil profissional
export async function salvarPerfilProfissional(campos) {
  const u = estado.usuario;
  if (!u || estado.visitante) throw new Error('Crie sua conta primeiro.');
  const ref = doc(db, 'prestadores', u.id);
  const existe = (await getDoc(ref)).exists();
  if (existe) {
    // Só o que é do dono: contadores e reputação ficam como estão (a regra recusaria).
    await updateDoc(ref, { ...campos, ultimaAtividade: Date.now() });
  } else {
    await setDoc(ref, {
      id: u.id, nome: u.nome, categoriasExtras: [], descricao: '', anosExperiencia: 0,
      bairro: u.bairro || '', cidade: u.cidade || '', estado: u.estado || '', lat: u.lat ?? null, lng: u.lng ?? null,
      fotoUrl: '', capaUrl: '', telefone: u.telefone || '', genero: '', urgencia24h: false, petFriendly: false,
      verificado: false, disponivel: true, diasSemana: [1, 2, 3, 4, 5], horaInicio: '08:00', horaFim: '18:00',
      fotos: [], antesDepois: [], certificados: [], precoVisita: 0, precoHora: 0, notaMedia: 0, totalAvaliacoes: 0,
      distribuicao: [0, 0, 0, 0, 0], contatosRecebidos: 0, contatosRespondidos: 0, selos: {}, visualizacoes: 0,
      criadoEm: Date.now(), ...campos, ultimaAtividade: Date.now(),
    });
    await updateDoc(doc(db, 'usuarios', u.id), { ehPrestador: true });
    estado.usuario = { ...u, ehPrestador: true };
  }
  cachePrestadores = null;
  avisar();
}

/** Números para a página "Conheça o Trampo" (lidos da base, não escritos à mão). */
export async function numerosDaBase() {
  const lista = await prestadores();
  const avaliacoes = lista.reduce((s, p) => s + (p.totalAvaliacoes || 0), 0);
  const comTaxa = lista.filter(p => (p.contatosRecebidos || 0) >= 5);
  const resposta = comTaxa.length ? Math.round(comTaxa.reduce((s, p) => s + p.contatosRespondidos / p.contatosRecebidos, 0) / comTaxa.length * 100) : null;
  const nota = avaliacoes ? lista.reduce((s, p) => s + (p.notaMedia || 0) * (p.totalAvaliacoes || 0), 0) / avaliacoes : null;
  const categorias = new Set(lista.map(p => p.categoriaId)).size;
  const cidades = new Set(lista.map(p => p.cidade)).size;
  const bairros = new Set(lista.map(p => p.bairro).filter(Boolean)).size;
  return { profissionais: lista.length, avaliacoes, resposta, nota, categorias, cidades, bairros };
}

export async function meuContatoCom(prestadorId) {
  const id = uid(); if (!id || estado.visitante) return null;
  try { const s = await getDoc(doc(db, 'contatos', `${id}_${prestadorId}`)); return s.exists() ? { id: s.id, ...s.data() } : null; }
  catch { return null; }
}

// ------------------------------------------------------------------ fotos (Storage)
let storageMod = null;
async function storage() {
  if (!storageMod) {
    const S = await import(`${B}/firebase-storage.js`);
    storageMod = { S, st: S.getStorage(app) };
  }
  return storageMod;
}

/** Reduz no navegador (lado maior 1600 px, JPEG 80%), igual ao Compressor.kt do app. */
async function reduzir(arquivo, lado = 1600) {
  const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bmp) return arquivo;
  const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
}

/** Envia uma foto para `<pasta>/<uid>/<data>` (regra do storage.rules) e devolve a URL pública. */
export async function enviarFoto(arquivo, pasta = 'trabalhos') {
  const id = uid(); if (!id || estado.visitante) throw new Error('Entre na sua conta');
  if (!arquivo.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  const { S, st } = await storage();
  const blob = await reduzir(arquivo);
  if (blob.size > 8 * 1024 * 1024) throw new Error('A foto passou de 8 MB mesmo reduzida.');
  const ref = S.ref(st, `${pasta}/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  await S.uploadBytes(ref, blob, { contentType: 'image/jpeg' });
  return await S.getDownloadURL(ref);
}

/** Apaga o arquivo do Storage (melhor esforço: a foto some do perfil mesmo se falhar). */
export async function apagarFoto(url) {
  try { const { S, st } = await storage(); await S.deleteObject(S.ref(st, url)); } catch { /* fica órfão, sem dano */ }
}
