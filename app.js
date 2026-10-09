// ============================================================
// UTILIDADES
// ============================================================

function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ============================================================
// SUPABASE: conexión y datos en memoria
// ============================================================

const sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const FUNCION_CUENTAS_URL = `${window.SUPABASE_URL}/functions/v1/admin-cuentas`;

let sesion = null;              // { id, nombre, rol, correo }
let listaPCs = [];               // computadoras + su software y bitácora
let catalogoProgramas = [];      // [{ id, nombre }]
let pendientes = [];             // [{ id, texto }]
let listaCuentas = [];           // perfiles (para la ventana de Cuentas)

let pcSeleccionadaId = null;
let filtroEstadoActual = 'todos';
let filtroSO = 'todos';
let filtroPrograma = 'todos';
let filtroProgramaEstado = 'no_instalado';

const ETIQUETA_ROL = { admin: 'Administrador', editor: 'Editor (no puede borrar)' };

function puedeBorrar() {
  return !!sesion && sesion.rol === 'admin';
}

async function llamarFuncionCuentas(payload) {
  const { data: { session } } = await sb.auth.getSession();
  const token = session?.access_token || window.SUPABASE_ANON_KEY;
  try {
    const resp = await fetch(FUNCION_CUENTAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': window.SUPABASE_ANON_KEY },
      body: JSON.stringify(payload)
    });
    return await resp.json();
  } catch (e) {
    return { error: 'No se pudo conectar con el servidor. Revisa tu conexión a internet.' };
  }
}

function mostrarAvisoSinConexion(hayError) {
  document.getElementById('aviso-sin-conexion').classList.toggle('hidden', !hayError);
  document.getElementById('aviso-sin-conexion').classList.toggle('flex', hayError);
}

// Referencias DOM
const listaPCsTabla = document.getElementById('lista-pcs-tabla');
const listaPCsCards = document.getElementById('lista-pcs-cards');
const formPC = document.getElementById('form-pc');
const estadoSelect = document.getElementById('pc-estado');
const problemaContainer = document.getElementById('campo-problema-container');
const formPendiente = document.getElementById('form-pendiente');
const listaPendientesUI = document.getElementById('lista-pendientes');
const listaAtencionUI = document.getElementById('lista-atencion');

function refrescarIconos() {
  document.querySelectorAll('i[data-lucide]').forEach(el => {
    const interno = ICONOS[el.getAttribute('data-lucide')];
    if (!interno) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', el.getAttribute('class') || '');
    svg.innerHTML = interno;
    el.replaceWith(svg);
  });
}

// ÍCONOS (Lucide, lucide.dev, licencia ISC) incrustados para no depender de internet
const ICONOS = {
  'settings': "<path d=\"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z\"></path><circle cx=\"12\" cy=\"12\" r=\"3\"></circle>",
  'rotate-ccw': "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"></path><path d=\"M3 3v5h5\"></path>",
  'map-pin': "<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\"></path><circle cx=\"12\" cy=\"10\" r=\"3\"></circle>",
  'keyboard': "<path d=\"M10 8h.01\"></path><path d=\"M12 12h.01\"></path><path d=\"M14 8h.01\"></path><path d=\"M16 12h.01\"></path><path d=\"M18 8h.01\"></path><path d=\"M6 8h.01\"></path><path d=\"M7 16h10\"></path><path d=\"M8 12h.01\"></path><rect width=\"20\" height=\"16\" x=\"2\" y=\"4\" rx=\"2\"></rect>",
  'info': "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"M12 16v-4\"></path><path d=\"M12 8h.01\"></path>",
  'alert-circle': "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><line x1=\"12\" x2=\"12\" y1=\"8\" y2=\"12\"></line><line x1=\"12\" x2=\"12.01\" y1=\"16\" y2=\"16\"></line>",
  'alert-triangle': "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"></path><path d=\"M12 9v4\"></path><path d=\"M12 17h.01\"></path>",
  'box': "<path d=\"M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z\"></path><path d=\"m3.3 7 8.7 5 8.7-5\"></path><path d=\"M12 22V12\"></path>",
  'check': "<path d=\"M20 6 9 17l-5-5\"></path>",
  'download': "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path><polyline points=\"7 10 12 15 17 10\"></polyline><line x1=\"12\" x2=\"12\" y1=\"15\" y2=\"3\"></line>",
  'history': "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"></path><path d=\"M3 3v5h5\"></path><path d=\"M12 7v5l4 2\"></path>",
  'layout-dashboard': "<rect width=\"7\" height=\"9\" x=\"3\" y=\"3\" rx=\"1\"></rect><rect width=\"7\" height=\"5\" x=\"14\" y=\"3\" rx=\"1\"></rect><rect width=\"7\" height=\"9\" x=\"14\" y=\"12\" rx=\"1\"></rect><rect width=\"7\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\"></rect>",
  'lock': "<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"></path>",
  'log-out': "<path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"></path><polyline points=\"16 17 21 12 16 7\"></polyline><line x1=\"21\" x2=\"9\" y1=\"12\" y2=\"12\"></line>",
  'menu': "<line x1=\"4\" x2=\"20\" y1=\"12\" y2=\"12\"></line><line x1=\"4\" x2=\"20\" y1=\"6\" y2=\"6\"></line><line x1=\"4\" x2=\"20\" y1=\"18\" y2=\"18\"></line>",
  'monitor': "<rect width=\"20\" height=\"14\" x=\"2\" y=\"3\" rx=\"2\"></rect><line x1=\"8\" x2=\"16\" y1=\"21\" y2=\"21\"></line><line x1=\"12\" x2=\"12\" y1=\"17\" y2=\"21\"></line>",
  'moon': "<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\"></path>",
  'pencil': "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\"></path><path d=\"m15 5 4 4\"></path>",
  'plus': "<path d=\"M5 12h14\"></path><path d=\"M12 5v14\"></path>",
  'search': "<circle cx=\"11\" cy=\"11\" r=\"8\"></circle><path d=\"m21 21-4.3-4.3\"></path>",
  'sun': "<circle cx=\"12\" cy=\"12\" r=\"4\"></circle><path d=\"M12 2v2\"></path><path d=\"M12 20v2\"></path><path d=\"m4.93 4.93 1.41 1.41\"></path><path d=\"m17.66 17.66 1.41 1.41\"></path><path d=\"M2 12h2\"></path><path d=\"M20 12h2\"></path><path d=\"m6.34 17.66-1.41 1.41\"></path><path d=\"m19.07 4.93-1.41 1.41\"></path>",
  'terminal': "<polyline points=\"4 17 10 11 4 5\"></polyline><line x1=\"12\" x2=\"20\" y1=\"19\" y2=\"19\"></line>",
  'trash-2': "<path d=\"M3 6h18\"></path><path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\"></path><path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\"></path><line x1=\"10\" x2=\"10\" y1=\"11\" y2=\"17\"></line><line x1=\"14\" x2=\"14\" y1=\"11\" y2=\"17\"></line>",
  'x': "<path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path>",
  'minus-circle': "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"M8 12h8\"></path>",
  'check-circle-2': "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"m9 12 2 2 4-4\"></path>",
  'users': "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"></path><circle cx=\"9\" cy=\"7\" r=\"4\"></circle><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"></path><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"></path>",
  'user-plus': "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"></path><circle cx=\"9\" cy=\"7\" r=\"4\"></circle><line x1=\"19\" x2=\"19\" y1=\"8\" y2=\"14\"></line><line x1=\"22\" x2=\"16\" y1=\"11\" y2=\"11\"></line>",
  'loader': "<path d=\"M21 12a9 9 0 1 1-6.219-8.56\"></path>",
  'eye': "<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"></path><circle cx=\"12\" cy=\"12\" r=\"3\"></circle>",
  'eye-off': "<path d=\"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49\"></path><path d=\"M14.084 14.158a3 3 0 0 1-4.242-4.242\"></path><path d=\"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143\"></path><path d=\"m2 2 20 20\"></path>",
  'wifi-off': "<path d=\"M12 20h.01\"></path><path d=\"M8.5 16.429a5 5 0 0 1 7 0\"></path><path d=\"M5 12.859a10 10 0 0 1 5.17-2.69\"></path><path d=\"M19 12.859a10 10 0 0 0-2.007-1.523\"></path><path d=\"M2 8.82a15 15 0 0 1 4.177-2.643\"></path><path d=\"M22 8.82a15 15 0 0 0-11.288-3.764\"></path><path d=\"m2 2 20 20\"></path>"
};

// ============================================================
// TEMA CLARO / OSCURO
// ============================================================

function temaEfectivo() {
  const forzado = document.documentElement.getAttribute('data-theme');
  if (forzado === 'dark' || forzado === 'light') return forzado;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function alternarTema() {
  const nuevo = temaEfectivo() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', nuevo);
  try { localStorage.setItem('lab_tema', nuevo); } catch (e) {}
  actualizarBotonesTema();
}

// 'light' | 'dark' | 'sistema' (sigue el modo del dispositivo)
function elegirTema(opcion) {
  if (opcion === 'sistema') {
    document.documentElement.removeAttribute('data-theme');
    try { localStorage.removeItem('lab_tema'); } catch (e) {}
  } else {
    document.documentElement.setAttribute('data-theme', opcion);
    try { localStorage.setItem('lab_tema', opcion); } catch (e) {}
  }
  actualizarBotonesTema();
}

function actualizarBotonesTema() {
  const guardado = (() => { try { return localStorage.getItem('lab_tema'); } catch (e) { return null; } })();
  const actual = guardado === 'dark' || guardado === 'light' ? guardado : 'sistema';
  ['light', 'dark', 'sistema'].forEach(t => {
    const btn = document.getElementById(`config-tema-${t}`);
    if (btn) btn.classList.toggle('is-active', t === actual);
  });
}

// Muestra u oculta el texto de un campo de contraseña
function alternarVerClave(idCampo, boton) {
  const campo = document.getElementById(idCampo);
  const mostrando = campo.type === 'text';
  campo.type = mostrando ? 'password' : 'text';
  boton.setAttribute('aria-pressed', String(!mostrando));
  boton.setAttribute('aria-label', mostrando ? 'Mostrar contraseña' : 'Ocultar contraseña');
  boton.innerHTML = `<i data-lucide="${mostrando ? 'eye' : 'eye-off'}" class="w-4 h-4"></i>`;
  refrescarIconos();
}

// ============================================================
// 0. SESIÓN (Supabase Auth, por correo)
// ============================================================

async function iniciarApp() {
  iniciarReloj();

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await cargarPerfilYEntrar(session.user);
  } else {
    await prepararPantallaLogin();
  }
  refrescarIconos();
}

async function prepararPantallaLogin() {
  document.getElementById('login-cargando').classList.remove('hidden');
  const { data, error } = await sb.rpc('hay_cuentas');
  document.getElementById('login-cargando').classList.add('hidden');

  if (!error && data === false) {
    document.getElementById('form-alta-inicial').classList.remove('hidden');
    document.getElementById('form-login').classList.add('hidden');
  } else {
    document.getElementById('form-alta-inicial').classList.add('hidden');
    document.getElementById('form-login').classList.remove('hidden');
  }
  refrescarIconos();
}

async function cargarPerfilYEntrar(user) {
  let { data: perfil } = await sb.from('profiles').select('nombre,rol,correo').eq('id', user.id).single();
  if (!perfil) {
    // El perfil lo crea un disparador (trigger) al registrarse; puede tardar un instante.
    await new Promise(r => setTimeout(r, 800));
    ({ data: perfil } = await sb.from('profiles').select('nombre,rol,correo').eq('id', user.id).single());
  }

  sesion = {
    id: user.id,
    nombre: perfil?.nombre || user.email,
    rol: perfil?.rol || 'editor',
    correo: perfil?.correo || user.email
  };

  document.getElementById('sesion-nombre').textContent = sesion.nombre;
  document.getElementById('sesion-rol').textContent = ETIQUETA_ROL[sesion.rol];
  document.getElementById('sesion-inicial').textContent = sesion.nombre.charAt(0).toUpperCase();
  document.getElementById('btn-nav-cuentas').classList.toggle('hidden', sesion.rol !== 'admin');
  document.getElementById('pantalla-login').classList.add('hidden');

  cambiarVentana('dashboard');
  await cargarConfiguracionLab();
  await cargarTodo();
}

async function cerrarSesion() {
  if (!confirm('¿Quieres cerrar tu sesión?')) return;
  await sb.auth.signOut();
  sesion = null;

  cerrarMenu();
  document.getElementById('modal-pc').classList.add('hidden');
  document.getElementById('modal-catalogo-software').classList.add('hidden');
  document.getElementById('modal-software-pc').classList.add('hidden');
  document.getElementById('form-login').reset();
  document.getElementById('login-error').classList.add('hidden');
  await prepararPantallaLogin();
}

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  document.getElementById('login-error').classList.add('hidden');
  const correo = document.getElementById('login-usuario').value.trim();
  const clave = document.getElementById('login-clave').value;
  const boton = e.target.querySelector('button[type=submit]');

  boton.disabled = true;
  const { data, error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
  boton.disabled = false;

  if (error || !data.session) {
    document.getElementById('login-error').classList.remove('hidden');
    return;
  }
  document.getElementById('form-login').reset();
  await cargarPerfilYEntrar(data.user);
});

document.getElementById('form-alta-inicial').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorTexto = document.getElementById('alta-inicial-error-texto');
  const errorCont = document.getElementById('alta-inicial-error');
  errorCont.classList.add('hidden');

  const nombre = document.getElementById('alta-inicial-nombre').value.trim();
  const correo = document.getElementById('alta-inicial-correo').value.trim();
  const clave = document.getElementById('alta-inicial-clave').value;
  const boton = e.target.querySelector('button[type=submit]');

  boton.disabled = true;
  const resultado = await llamarFuncionCuentas({ accion: 'crear', nombre, correo, clave });
  boton.disabled = false;

  if (resultado.error) {
    errorTexto.textContent = resultado.error;
    errorCont.classList.remove('hidden');
    return;
  }

  const { data, error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
  if (error) {
    document.getElementById('form-alta-inicial').classList.add('hidden');
    document.getElementById('form-login').classList.remove('hidden');
    return;
  }
  await cargarPerfilYEntrar(data.user);
});

// ============================================================
// 1. NAVEGACIÓN Y RELOJ
// ============================================================

let _ventanaActual = 'dashboard';

const VENTANAS = {
  dashboard: { boton: 'btn-nav-dashboard', seccion: 'ventana-dashboard', titulo: 'Panel principal', subtitulo: 'Resumen del laboratorio' },
  pcs:       { boton: 'btn-nav-pcs',       seccion: 'ventana-pcs',       titulo: 'Equipos de cómputo', subtitulo: 'Computadoras, sistemas operativos y programas instalados' },
  bitacora:  { boton: 'btn-nav-bitacora',  seccion: 'ventana-bitacora',  titulo: 'Bitácora de mantenimiento', subtitulo: 'Trabajos preventivos, correctivos y actualizaciones' },
  cuentas:   { boton: 'btn-nav-cuentas',   seccion: 'ventana-cuentas',   titulo: 'Cuentas', subtitulo: 'Da de alta o elimina accesos de encargados y prestadores' },
  configuracion: { boton: 'btn-nav-configuracion', seccion: 'ventana-configuracion', titulo: 'Configuración', subtitulo: 'Ajustes de tu cuenta y del laboratorio' }
};

function cambiarVentana(ventana) {
  if (ventana === 'cuentas' && (!sesion || sesion.rol !== 'admin')) ventana = 'dashboard';

  Object.entries(VENTANAS).forEach(([clave, v]) => {
    const activa = clave === ventana;
    document.getElementById(v.seccion).classList.toggle('hidden', !activa);
    const btn = document.getElementById(v.boton);
    btn.classList.toggle('is-active', activa);
    if (activa) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
  });

  _ventanaActual = ventana;
  const v = VENTANAS[ventana];
  document.getElementById('titulo-ventana').textContent = v.titulo;
  document.getElementById('subtitulo-ventana').textContent = v.subtitulo;

  if (ventana === 'bitacora') prepararVentanaBitacora();
  if (ventana === 'cuentas') renderizarCuentas();
  if (ventana === 'configuracion') prepararVentanaConfiguracion();

  cerrarMenu();
  refrescarIconos();
}

function abrirMenu() {
  document.getElementById('sidebar').classList.remove('-translate-x-full');
  document.getElementById('overlay-menu').classList.remove('hidden');
}

function cerrarMenu() {
  document.getElementById('sidebar').classList.add('-translate-x-full');
  document.getElementById('overlay-menu').classList.add('hidden');
}

function iniciarReloj() {
  const relojElemento = document.getElementById('reloj-vivo');
  const pintar = () => {
    relojElemento.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  pintar();
  setInterval(pintar, 1000);
}

// ============================================================
// 2. CARGA DE DATOS DESDE SUPABASE
// ============================================================

async function cargarCatalogo() {
  const { data, error } = await sb.from('catalogo_programas').select('id,nombre,agregado_por').order('nombre');
  mostrarAvisoSinConexion(!!error);
  catalogoProgramas = data || [];
}

async function cargarPendientes() {
  const { data, error } = await sb.from('pendientes').select('id,texto,creado_por').order('creado_en');
  mostrarAvisoSinConexion(!!error);
  pendientes = data || [];
}

async function cargarPCs() {
  const [{ data: pcs, error: e1 }, { data: sw, error: e2 }, { data: bit, error: e3 }] = await Promise.all([
    sb.from('computadoras').select('*').order('nombre'),
    sb.from('pc_software').select('computadora_id,programa_id,estado'),
    sb.from('bitacora').select('*').order('fecha', { ascending: false })
  ]);
  mostrarAvisoSinConexion(!!(e1 || e2 || e3));

  const nombrePorId = {};
  catalogoProgramas.forEach(p => { nombrePorId[p.id] = p.nombre; });

  listaPCs = (pcs || []).map(pc => {
    const softwareEstado = {};
    (sw || []).filter(s => s.computadora_id === pc.id).forEach(s => {
      const nombre = nombrePorId[s.programa_id];
      if (nombre) softwareEstado[nombre] = s.estado;
    });
    const bitacora = (bit || []).filter(b => b.computadora_id === pc.id)
      .map(b => ({ fecha: b.fecha, tipo: b.tipo, desc: b.descripcion, autor: b.autor_nombre }));
    return { ...pc, softwareEstado, bitacora };
  });
}

async function cargarTodo() {
  await cargarCatalogo();
  await cargarPCs();
  await cargarPendientes();
  actualizarTodo();
}

// ============================================================
// 3. MODAL REGISTRO PC
// ============================================================

function abrirModalPC(id = null) {
  const tituloModal = document.getElementById('modal-pc-titulo');
  const editIdInput = document.getElementById('pc-edit-id');
  document.getElementById('alerta-ip-duplicada').classList.add('hidden');

  if (id !== null && id !== undefined) {
    const pc = listaPCs.find(p => p.id === id);
    editIdInput.value = id;
    document.getElementById('pc-nombre').value = pc.nombre;
    document.getElementById('pc-marca').value = pc.marca;
    document.getElementById('pc-ubicacion').value = pc.ubicacion || '';
    document.getElementById('pc-so').value = pc.so || 'Windows 11';
    document.getElementById('pc-mac').value = pc.mac;
    document.getElementById('pc-internet').value = pc.internet ? 'si' : 'no';
    document.getElementById('pc-ip').value = pc.ip || '';
    alternarCampoIP();
    estadoSelect.value = pc.funcional ? 'funcional' : 'atencion';
    document.getElementById('pc-problema').value = pc.problema || '';

    problemaContainer.classList.toggle('hidden', pc.funcional);
    tituloModal.textContent = 'Editar equipo';
  } else {
    editIdInput.value = '';
    formPC.reset();
    alternarCampoIP();
    problemaContainer.classList.add('hidden');
    tituloModal.textContent = 'Registrar equipo';
  }

  document.getElementById('modal-pc').classList.remove('hidden');
  refrescarIconos();
}

function cerrarModalPC() {
  document.getElementById('modal-pc').classList.add('hidden');
  formPC.reset();
  document.getElementById('pc-edit-id').value = '';
  problemaContainer.classList.add('hidden');
  alternarCampoIP();
}

function alternarCampoIP() {
  const conInternet = document.getElementById('pc-internet').value === 'si';
  document.getElementById('pc-ip-container').classList.toggle('hidden', !conInternet);
  if (!conInternet) {
    document.getElementById('pc-ip').value = '';
    document.getElementById('alerta-ip-duplicada').classList.add('hidden');
  }
}

function validarIpDuplicadaInput() {
  const ipValue = document.getElementById('pc-ip').value.trim();
  const editId = document.getElementById('pc-edit-id').value;
  const alerta = document.getElementById('alerta-ip-duplicada');

  if (!ipValue) { alerta.classList.add('hidden'); return; }

  const existe = listaPCs.some(pc => {
    if (editId !== '' && pc.id === Number(editId)) return false;
    return pc.internet && pc.ip && pc.ip.trim() === ipValue;
  });

  alerta.classList.toggle('hidden', !existe);
}

estadoSelect.addEventListener('change', () => {
  problemaContainer.classList.toggle('hidden', estadoSelect.value !== 'atencion');
});

formPC.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = document.getElementById('pc-edit-id').value;
  const tieneInternet = document.getElementById('pc-internet').value === 'si';

  const datosPC = {
    nombre: document.getElementById('pc-nombre').value.trim(),
    marca: document.getElementById('pc-marca').value.trim(),
    ubicacion: document.getElementById('pc-ubicacion').value.trim(),
    so: document.getElementById('pc-so').value,
    mac: document.getElementById('pc-mac').value.trim(),
    internet: tieneInternet,
    ip: tieneInternet ? document.getElementById('pc-ip').value.trim() : '',
    funcional: estadoSelect.value === 'funcional',
    problema: estadoSelect.value === 'atencion' ? document.getElementById('pc-problema').value.trim() : ''
  };

  const boton = e.target.querySelector('button[type=submit]');
  boton.disabled = true;
  let error;
  if (editId !== '') {
    ({ error } = await sb.from('computadoras').update({ ...datosPC, modificado_por: sesion.nombre }).eq('id', Number(editId)));
  } else {
    ({ error } = await sb.from('computadoras').insert({ ...datosPC, creado_por: sesion.nombre, modificado_por: sesion.nombre }));
  }
  boton.disabled = false;

  if (error) { alert('No se pudo guardar el equipo: ' + error.message); return; }

  cerrarModalPC();
  await cargarPCs();
  actualizarTodo();
});

async function eliminarPC(id) {
  if (!puedeBorrar()) return;
  const pc = listaPCs.find(p => p.id === id);
  if (!pc || !confirm(`¿Estás seguro de eliminar el equipo ${pc.nombre}?`)) return;

  const { error } = await sb.from('computadoras').delete().eq('id', id);
  if (error) { alert('No se pudo eliminar: ' + error.message); return; }

  await cargarPCs();
  actualizarTodo();
}

// ============================================================
// 4. FILTROS Y BÚSQUEDA
// ============================================================

function setFiltroEstado(filtro) {
  filtroEstadoActual = filtro;
  ['todos', 'funcional', 'atencion', 'sin_ip'].forEach(b => {
    document.getElementById(`filtro-${b}`).classList.toggle('is-active', b === filtro);
  });
  renderizarTablaPCs();
}

function filtrarPCs() { renderizarTablaPCs(); }

function poblarFiltros() {
  const selSO = document.getElementById('filtro-so');
  const selProg = document.getElementById('filtro-programa');
  const selProgEstado = document.getElementById('filtro-programa-estado');

  const sistemas = Array.from(document.getElementById('pc-so').options).map(o => o.value);
  listaPCs.forEach(pc => { if (pc.so && !sistemas.includes(pc.so)) sistemas.push(pc.so); });

  selSO.innerHTML = `<option value="todos">Sistema: todos</option>` + sistemas.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  if (!sistemas.includes(filtroSO)) filtroSO = 'todos';
  selSO.value = filtroSO;

  const nombresProgramas = catalogoProgramas.map(p => p.nombre);
  selProg.innerHTML = `<option value="todos">Programa: todos</option>` + nombresProgramas.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  if (!nombresProgramas.includes(filtroPrograma)) filtroPrograma = 'todos';
  selProg.value = filtroPrograma;

  selProgEstado.value = filtroProgramaEstado;
  selProgEstado.classList.toggle('hidden', filtroPrograma === 'todos');
}

function cambiarFiltroSO(valor) { filtroSO = valor; renderizarTablaPCs(); }
function cambiarFiltroPrograma(valor) {
  filtroPrograma = valor;
  document.getElementById('filtro-programa-estado').classList.toggle('hidden', valor === 'todos');
  renderizarTablaPCs();
}
function cambiarFiltroProgramaEstado(valor) { filtroProgramaEstado = valor; renderizarTablaPCs(); }

function limpiarFiltros() {
  document.getElementById('input-busqueda').value = '';
  filtroSO = 'todos'; filtroPrograma = 'todos'; filtroProgramaEstado = 'no_instalado';
  poblarFiltros();
  setFiltroEstado('todos');
}

function obtenerPCsFiltradas() {
  const query = document.getElementById('input-busqueda').value.toLowerCase().trim();

  return listaPCs.filter(pc => {
    const matchQuery = pc.nombre.toLowerCase().includes(query) ||
                       pc.marca.toLowerCase().includes(query) ||
                       (pc.so && pc.so.toLowerCase().includes(query)) ||
                       pc.mac.toLowerCase().includes(query) ||
                       (pc.ip && pc.ip.toLowerCase().includes(query));
    if (!matchQuery) return false;

    if (filtroEstadoActual === 'funcional' && !pc.funcional) return false;
    if (filtroEstadoActual === 'atencion' && pc.funcional) return false;
    if (filtroEstadoActual === 'sin_ip' && pc.internet) return false;
    if (filtroSO !== 'todos' && pc.so !== filtroSO) return false;

    if (filtroPrograma !== 'todos') {
      const estadoProg = (pc.softwareEstado && pc.softwareEstado[filtroPrograma]) || 'no_instalado';
      if (estadoProg !== filtroProgramaEstado) return false;
    }
    return true;
  });
}

// ============================================================
// 5. TABLA, TARJETAS Y MÉTRICAS
// ============================================================

function actualizarTodo() {
  renderizarMetricas();
  poblarFiltros();
  renderizarTablaPCs();
  renderizarPendientes();
  renderizarAtencion();
  refrescarIconos();
}

function renderizarMetricas() {
  const total = listaPCs.length;
  const conIP = listaPCs.filter(pc => pc.internet).length;
  const conFalla = listaPCs.filter(pc => !pc.funcional).length;
  const ok = total - conFalla;

  document.getElementById('metric-total-pcs').textContent = total;
  document.getElementById('metric-conectados').textContent = conIP;
  document.getElementById('metric-atencion').textContent = conFalla;

  let frase;
  if (total === 0) frase = 'Aún no hay equipos registrados.';
  else if (conFalla === 0) frase = total === 1 ? 'El equipo funciona correctamente.' : `Los ${total} equipos funcionan correctamente.`;
  else if (ok === 0) frase = total === 1 ? 'El equipo necesita atención.' : `Ninguno de los ${total} equipos funciona bien.`;
  else frase = `${ok === 1 ? 'Funciona' : 'Funcionan'} ${ok} de ${total} equipos. ${conFalla} ${conFalla === 1 ? 'necesita' : 'necesitan'} atención.`;
  document.getElementById('hero-frase').textContent = frase;

  const pctOk = total ? (ok / total) * 100 : 0;
  const pctMal = total ? (conFalla / total) * 100 : 0;
  document.getElementById('hero-barra-ok').style.width = pctOk + '%';
  document.getElementById('hero-barra-bad').style.width = pctMal + '%';
  document.getElementById('hero-barra').setAttribute('aria-label', total ? `${ok} de ${total} equipos funcionales` : 'Sin equipos registrados');
}

function resumenSoftware(pc) {
  let ok = 0, conFalla = 0;
  Object.values(pc.softwareEstado || {}).forEach(est => {
    if (est === 'funcional') ok++;
    if (est === 'no_funcional') conFalla++;
  });
  return { ok, conFalla };
}

function botonSoftwareHTML(pc) {
  const { ok, conFalla } = resumenSoftware(pc);
  const texto = (ok + conFalla === 0) ? 'Ver programas' : `${ok} ${ok === 1 ? 'funciona' : 'funcionan'}`;
  return `
    <button onclick="abrirModalSoftwarePC(${pc.id})" class="btn btn-outline btn-sm" title="Ver y cambiar el estado de los programas">
      <i data-lucide="box" class="w-4 h-4"></i>
      <span>${texto}</span>
      ${conFalla > 0 ? `<span class="badge badge-bad">${conFalla} con fallo</span>` : ''}
    </button>`;
}

function botonesAccionHTML(pc) {
  return `
    <div class="inline-flex items-center gap-1">
      <button onclick="abrirModalPC(${pc.id})" title="Editar PC" aria-label="Editar ${esc(pc.nombre)}" class="btn btn-ghost btn-square">
        <i data-lucide="pencil" class="w-4 h-4"></i>
      </button>
      ${puedeBorrar() ? `
      <button onclick="eliminarPC(${pc.id})" title="Eliminar PC" aria-label="Eliminar ${esc(pc.nombre)}" class="btn btn-ghost btn-square btn-danger">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>` : ''}
    </div>`;
}

function insigniaEstadoHTML(pc) {
  return `<span class="badge ${pc.funcional ? 'badge-ok' : 'badge-bad'}"><span class="dot"></span>${pc.funcional ? 'Funcional' : 'Con atención'}</span>`;
}

function crearFilaPC(pc) {
  const tieneInternet = !!pc.internet;
  const textoIP = tieneInternet ? (pc.ip ? esc(pc.ip) : 'Sin IP registrada') : 'Sin conexión';
  const tr = document.createElement('tr');
  tr.className = "hover:bg-sunken/60 transition-colors";
  tr.innerHTML = `
    <td class="px-4 py-3 whitespace-nowrap">
      <p class="font-semibold">${esc(pc.nombre)}</p>
      <p class="text-xs text-muted">${esc(pc.marca)}</p>
      ${pc.ubicacion ? `<p class="text-xs text-muted flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3"></i>${esc(pc.ubicacion)}</p>` : ''}
    </td>
    <td class="px-4 py-3 whitespace-nowrap"><span class="badge badge-neutral">${esc(pc.so || 'Windows 11')}</span></td>
    <td class="px-4 py-3 font-mono text-xs whitespace-nowrap">
      <p class="${tieneInternet ? 'text-ok-ink' : 'text-subtle'}">${textoIP}</p>
      <p class="text-muted">${esc(pc.mac)}</p>
    </td>
    <td class="px-4 py-3 whitespace-nowrap">${insigniaEstadoHTML(pc)}</td>
    <td class="px-4 py-3 whitespace-nowrap">${botonSoftwareHTML(pc)}</td>
    <td class="px-4 py-3 text-right whitespace-nowrap">
      <div class="flex flex-col items-end gap-1">
        ${botonesAccionHTML(pc)}
        ${pc.modificado_por ? `<span class="text-xs text-muted">Por ${esc(pc.modificado_por)}</span>` : ''}
      </div>
    </td>
  `;
  return tr;
}

function crearTarjetaPC(pc) {
  const tieneInternet = !!pc.internet;
  const textoIP = tieneInternet ? (pc.ip ? esc(pc.ip) : 'Sin IP registrada') : 'Sin conexión';
  const div = document.createElement('div');
  div.className = "panel p-4 space-y-3";
  div.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="font-semibold truncate">${esc(pc.nombre)}</p>
        <p class="text-sm text-muted truncate">${esc(pc.marca)}</p>
        ${pc.ubicacion ? `<p class="text-xs text-muted flex items-center gap-1 mt-0.5"><i data-lucide="map-pin" class="w-3 h-3"></i>${esc(pc.ubicacion)}</p>` : ''}
      </div>
      <div class="shrink-0">${insigniaEstadoHTML(pc)}</div>
    </div>
    ${!pc.funcional && pc.problema ? `<p class="text-sm text-bad-ink bg-bad-soft rounded-lg px-3 py-2">${esc(pc.problema)}</p>` : ''}
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span class="badge badge-neutral">${esc(pc.so || 'Windows 11')}</span>
      <span class="font-mono text-xs text-muted">${esc(pc.mac)}</span>
      <span class="font-mono text-xs ${tieneInternet ? 'text-ok-ink' : 'text-subtle'}">${textoIP}</span>
    </div>
    <div class="flex items-center justify-between gap-2 pt-3 border-t border-line">
      ${botonSoftwareHTML(pc)}
      ${botonesAccionHTML(pc)}
    </div>
    ${pc.modificado_por ? `<p class="text-xs text-muted text-right">Última modificación: ${esc(pc.modificado_por)}</p>` : ''}
  `;
  return div;
}

function renderizarTablaPCs() {
  listaPCsTabla.innerHTML = '';
  listaPCsCards.innerHTML = '';

  const pcsFiltradas = obtenerPCsFiltradas();
  document.getElementById('contador-pcs').textContent = `Mostrando ${pcsFiltradas.length} de ${listaPCs.length} equipos`;

  if (pcsFiltradas.length === 0) {
    const sinEquipos = listaPCs.length === 0;
    const mensaje = sinEquipos ? 'Todavía no hay equipos. Agrega el primero con «Agregar equipo».' : 'Ningún equipo coincide con la búsqueda o los filtros.';
    const accion = sinEquipos ? '' : `<button onclick="limpiarFiltros()" class="btn btn-outline btn-sm mt-3">Limpiar filtros</button>`;
    listaPCsTabla.innerHTML = `<tr><td colspan="6" class="px-6 py-12 text-center text-muted text-sm">${mensaje}<br>${accion}</td></tr>`;
    listaPCsCards.innerHTML = `<div class="col-span-full panel px-6 py-10 text-center text-muted text-sm">${mensaje}<br>${accion}</div>`;
    return;
  }

  pcsFiltradas.forEach(pc => {
    listaPCsTabla.appendChild(crearFilaPC(pc));
    listaPCsCards.appendChild(crearTarjetaPC(pc));
  });
  refrescarIconos();
}

// ============================================================
// 6. EXPORTAR A EXCEL / CSV
// ============================================================

function csvCampo(valor) {
  let texto = String(valor ?? '');
  if (/^[=+\-@\t\r]/.test(texto)) texto = "'" + texto;
  return `"${texto.replace(/"/g, '""')}"`;
}

function exportarCSV() {
  if (listaPCs.length === 0) { alert("No hay equipos para exportar."); return; }

  const filas = [["Equipo", "Marca", "Sistema Operativo", "MAC", "Internet", "IP", "Estado", "Detalle Problema"]];
  listaPCs.forEach(pc => {
    filas.push([
      pc.nombre, pc.marca, pc.so || 'Windows 11', pc.mac,
      pc.internet ? "Si" : "No",
      pc.internet ? (pc.ip || "Sin IP registrada") : "",
      pc.funcional ? "Funcional" : "Atencion",
      pc.problema || ""
    ]);
  });

  const csv = '\uFEFF' + filas.map(fila => fila.map(csvCampo).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Inventario_Laboratorio_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================
// 7. BITÁCORA
// ============================================================

function prepararVentanaBitacora() {
  const selectPC = document.getElementById('bitacora-pc-select');
  selectPC.innerHTML = listaPCs.length === 0
    ? `<option value="">No hay equipos registrados</option>`
    : listaPCs.map(pc => `<option value="${pc.id}">${esc(pc.nombre)} - ${esc(pc.marca)}</option>`).join('');
  document.getElementById('bitacora-fecha-v').value = new Date().toISOString().slice(0, 10);
  renderizarBitacoraVentana();
}

document.getElementById('form-bitacora-ventana').addEventListener('submit', async (e) => {
  e.preventDefault();
  const computadoraId = Number(document.getElementById('bitacora-pc-select').value);
  if (!computadoraId) return;

  const fecha = document.getElementById('bitacora-fecha-v').value;
  const tipo = document.getElementById('bitacora-tipo-v').value;
  const descripcion = document.getElementById('bitacora-desc-v').value.trim();
  if (!descripcion) return;

  const boton = e.target.querySelector('button[type=submit]');
  boton.disabled = true;
  const { error } = await sb.from('bitacora').insert({
    computadora_id: computadoraId, fecha, tipo, descripcion,
    autor_id: sesion.id, autor_nombre: sesion.nombre
  });
  boton.disabled = false;

  if (error) { alert('No se pudo guardar el registro: ' + error.message); return; }

  document.getElementById('bitacora-desc-v').value = '';
  await cargarPCs();
  renderizarBitacoraVentana();
  renderizarTablaPCs();
});

function renderizarBitacoraVentana() {
  const container = document.getElementById('lista-bitacora-ventana-ui');
  const query = document.getElementById('input-filtro-bitacora').value.toLowerCase().trim();
  container.innerHTML = '';

  let todosEventos = [];
  listaPCs.forEach(pc => (pc.bitacora || []).forEach(e => todosEventos.push({ ...e, pcNombre: pc.nombre })));
  todosEventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  if (query) {
    todosEventos = todosEventos.filter(e =>
      e.pcNombre.toLowerCase().includes(query) || e.tipo.toLowerCase().includes(query) ||
      e.desc.toLowerCase().includes(query) || e.fecha.includes(query) ||
      (e.autor && e.autor.toLowerCase().includes(query))
    );
  }

  if (todosEventos.length === 0) {
    container.innerHTML = `<li class="text-sm text-muted py-8 text-center">No hay registros de mantenimiento que coincidan.</li>`;
    return;
  }

  todosEventos.forEach(item => {
    let tag = 'badge-brand';
    if (item.tipo === 'Correctivo') tag = 'badge-bad';
    if (item.tipo === 'Preventivo') tag = 'badge-ok';

    const li = document.createElement('li');
    li.className = "rounded-xl border border-line p-4 space-y-2";
    li.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2 min-w-0">
          <span class="font-semibold">${esc(item.pcNombre)}</span>
          <span class="badge ${tag}">${esc(item.tipo)}</span>
        </div>
        <span class="text-sm text-muted shrink-0 tabular">${esc(item.fecha)}</span>
      </div>
      <p class="text-sm leading-relaxed">${esc(item.desc)}</p>
      ${item.autor ? `<p class="text-xs text-muted">Registrado por ${esc(item.autor)}</p>` : ''}
    `;
    container.appendChild(li);
  });
}

// ============================================================
// 8. CATÁLOGO Y SOFTWARE EN PC
// ============================================================

function abrirModalCatalogoSoftware() {
  renderizarListaCatalogo();
  document.getElementById('modal-catalogo-software').classList.remove('hidden');
}
function cerrarModalCatalogoSoftware() {
  document.getElementById('modal-catalogo-software').classList.add('hidden');
}

function abrirModalSoftwarePC(id) {
  pcSeleccionadaId = id;
  const pc = listaPCs.find(p => p.id === id);
  document.getElementById('software-modal-titulo').textContent = `Programas de ${pc.nombre}`;
  renderizarTarjetasSoftwarePC();
  document.getElementById('modal-software-pc').classList.remove('hidden');
  refrescarIconos();
}

function cerrarModalSoftwarePC() {
  document.getElementById('modal-software-pc').classList.add('hidden');
  pcSeleccionadaId = null;
  renderizarTablaPCs();
}

function renderizarListaCatalogo() {
  const container = document.getElementById('lista-catalogo-software-ui');
  container.innerHTML = '';

  if (catalogoProgramas.length === 0) {
    container.innerHTML = `<li class="text-sm text-muted py-4 text-center">El catálogo está vacío. Agrega el primer programa arriba.</li>`;
    return;
  }

  catalogoProgramas.forEach(prog => {
    const li = document.createElement('li');
    li.className = "flex items-center justify-between gap-2 rounded-lg bg-sunken pl-3 pr-1 py-1 text-sm";
    li.innerHTML = `
      <span class="truncate">
        ${esc(prog.nombre)}
        ${prog.agregado_por ? `<span class="block text-xs text-muted">Agregado por ${esc(prog.agregado_por)}</span>` : ''}
      </span>
      ${puedeBorrar() ? `
      <button onclick="eliminarProgramaCatalogo(${prog.id})" aria-label="Eliminar ${esc(prog.nombre)}" class="btn btn-ghost btn-square btn-danger">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>` : `
      <span title="Solo un administrador puede eliminar programas" class="p-2 text-subtle">
        <i data-lucide="lock" class="w-4 h-4"></i>
      </span>`}
    `;
    container.appendChild(li);
  });
  refrescarIconos();
}

document.getElementById('form-nuevo-programa-catalogo').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('nombre-programa-catalogo');
  const nombre = input.value.trim();
  if (!nombre || catalogoProgramas.some(p => p.nombre.toLowerCase() === nombre.toLowerCase())) return;

  const { error } = await sb.from('catalogo_programas').insert({ nombre, agregado_por: sesion.nombre });
  if (error) { alert('No se pudo agregar el programa: ' + error.message); return; }

  input.value = '';
  await cargarCatalogo();
  await cargarPCs();
  renderizarListaCatalogo();
  actualizarTodo();
});

async function eliminarProgramaCatalogo(id) {
  if (!puedeBorrar()) return;
  const prog = catalogoProgramas.find(p => p.id === id);
  if (!prog || !confirm(`¿Eliminar "${prog.nombre}" del catálogo? Se quitará de todas las computadoras.`)) return;

  const { error } = await sb.from('catalogo_programas').delete().eq('id', id);
  if (error) { alert('No se pudo eliminar: ' + error.message); return; }

  await cargarCatalogo();
  await cargarPCs();
  renderizarListaCatalogo();
  actualizarTodo();
}

function renderizarTarjetasSoftwarePC() {
  const grid = document.getElementById('grid-software-pc');
  grid.innerHTML = '';

  if (catalogoProgramas.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-8 text-center text-muted text-sm">No hay programas en el catálogo. Agrégalos desde «Catálogo de programas».</div>`;
    return;
  }

  const pc = listaPCs.find(p => p.id === pcSeleccionadaId);

  catalogoProgramas.forEach(prog => {
    const estadoActual = (pc.softwareEstado && pc.softwareEstado[prog.nombre]) || 'no_instalado';
    let config = { clase: 'sw-card', label: 'No instalado', icon: 'minus-circle' };
    if (estadoActual === 'funcional') config = { clase: 'sw-card sw-ok', label: 'Instalado y funcional', icon: 'check-circle-2' };
    else if (estadoActual === 'no_funcional') config = { clase: 'sw-card sw-bad', label: 'Instalado, con fallo', icon: 'alert-triangle' };

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.onclick = () => alternarEstadoSoftware(prog, estadoActual);
    btn.className = config.clase;
    btn.innerHTML = `
      <div class="flex items-start justify-between gap-2 w-full">
        <span class="font-semibold text-sm text-ink break-words">${esc(prog.nombre)}</span>
        <i data-lucide="${config.icon}" class="w-4 h-4 shrink-0"></i>
      </div>
      <p class="text-xs font-medium mt-3">${config.label}</p>
    `;
    grid.appendChild(btn);
  });
  refrescarIconos();
}

async function alternarEstadoSoftware(prog, estadoActual) {
  let nuevoEstado = 'funcional';
  if (estadoActual === 'funcional') nuevoEstado = 'no_funcional';
  else if (estadoActual === 'no_funcional') nuevoEstado = 'no_instalado';

  const pc = listaPCs.find(p => p.id === pcSeleccionadaId);
  pc.softwareEstado[prog.nombre] = nuevoEstado; // optimista: se ve al instante
  renderizarTarjetasSoftwarePC();

  const { error } = await sb.from('pc_software').upsert({ computadora_id: pc.id, programa_id: prog.id, estado: nuevoEstado });
  if (error) alert('No se pudo guardar el cambio: ' + error.message);
}

// ============================================================
// 9. PENDIENTES Y ATENCIÓN
// ============================================================

formPendiente.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('nuevo-pendiente');
  const texto = input.value.trim();
  if (!texto) return;

  const { error } = await sb.from('pendientes').insert({ texto, creado_por: sesion.nombre });
  if (error) { alert('No se pudo guardar: ' + error.message); return; }

  input.value = '';
  await cargarPendientes();
  renderizarPendientes();
});

let _pendienteABorrar = null; // { pendiente, temporizador }

function eliminarPendiente(id) {
  const pendiente = pendientes.find(p => p.id === id);
  if (!pendiente) return;

  // Se quita de la vista al instante (no se borra todavía de la base de datos)
  pendientes = pendientes.filter(p => p.id !== id);
  renderizarPendientes();

  if (_pendienteABorrar) clearTimeout(_pendienteABorrar.temporizador);
  _pendienteABorrar = {
    pendiente,
    temporizador: setTimeout(async () => {
      await sb.from('pendientes').delete().eq('id', id);
      _pendienteABorrar = null;
      ocultarToastDeshacer();
    }, 5000)
  };

  mostrarToastDeshacer('Pendiente eliminado');
}

function mostrarToastDeshacer(texto) {
  document.getElementById('toast-deshacer-texto').textContent = texto;
  document.getElementById('toast-deshacer').classList.remove('hidden');
  document.getElementById('toast-deshacer').classList.add('flex');
  refrescarIconos();
}

function ocultarToastDeshacer() {
  document.getElementById('toast-deshacer').classList.add('hidden');
  document.getElementById('toast-deshacer').classList.remove('flex');
}

function deshacerAccion() {
  if (!_pendienteABorrar) return;
  clearTimeout(_pendienteABorrar.temporizador);
  pendientes.push(_pendienteABorrar.pendiente);
  pendientes.sort((a, b) => a.id - b.id);
  _pendienteABorrar = null;
  ocultarToastDeshacer();
  renderizarPendientes();
}

function renderizarPendientes() {
  listaPendientesUI.innerHTML = '';
  document.getElementById('contador-pendientes').textContent = pendientes.length;

  if (pendientes.length === 0) {
    listaPendientesUI.innerHTML = `<li class="text-sm text-muted py-4 text-center">No hay pendientes. Escribe uno arriba para empezar la lista.</li>`;
    return;
  }

  pendientes.forEach(p => {
    const li = document.createElement('li');
    li.className = "group flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-sunken transition-colors";
    li.innerHTML = `
      <button onclick="eliminarPendiente(${p.id})" title="Marcar como hecho" aria-label="Marcar como hecho: ${esc(p.texto)}"
        class="mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 border-subtle text-ok-ink flex items-center justify-center hover:border-ok hover:bg-ok-soft transition-colors">
        <i data-lucide="check" class="w-3 h-3 opacity-0 group-hover:opacity-100"></i>
      </button>
      <span class="text-sm min-w-0 break-words">
        ${esc(p.texto)}
        ${p.creado_por ? `<span class="block text-xs text-muted mt-0.5">Agregado por ${esc(p.creado_por)}</span>` : ''}
      </span>
    `;
    listaPendientesUI.appendChild(li);
  });
  refrescarIconos();
}

function renderizarAtencion() {
  listaAtencionUI.innerHTML = '';
  const pcsConFallas = listaPCs.filter(pc => !pc.funcional);

  if (pcsConFallas.length === 0) {
    listaAtencionUI.innerHTML = `<li class="text-sm text-muted py-4 text-center">Todos los equipos están operando correctamente.</li>`;
    return;
  }

  pcsConFallas.forEach(pc => {
    const li = document.createElement('li');
    li.className = "rounded-xl bg-bad-soft p-3.5 space-y-1";
    li.innerHTML = `
      <div class="flex justify-between gap-3">
        <span class="font-semibold text-bad-ink min-w-0 break-words">${esc(pc.nombre)} <span class="font-normal">(${esc(pc.marca)})</span></span>
        <span class="font-mono text-xs text-muted shrink-0">${pc.internet ? esc(pc.ip || 'Con internet') : 'Sin IP'}</span>
      </div>
      <p class="text-sm">${esc(pc.problema || 'No se especificó la falla.')}</p>
    `;
    listaAtencionUI.appendChild(li);
  });
}

// ============================================================
// 9.5 CONFIGURACIÓN
// ============================================================

let nombreLaboratorio = 'LabControl';

async function cargarConfiguracionLab() {
  const { data } = await sb.from('configuracion_lab').select('valor').eq('clave', 'nombre_laboratorio').single();
  nombreLaboratorio = data?.valor || 'LabControl';
  document.getElementById('marca-nombre-lab').textContent = nombreLaboratorio;
}

function prepararVentanaConfiguracion() {
  document.getElementById('config-sesion-inicial').textContent = sesion.nombre.charAt(0).toUpperCase();
  document.getElementById('config-sesion-nombre').textContent = sesion.nombre;
  document.getElementById('config-sesion-correo').textContent = sesion.correo;
  actualizarBotonesTema();

  const panelLab = document.getElementById('config-panel-laboratorio');
  panelLab.classList.toggle('hidden', sesion.rol !== 'admin');
  if (sesion.rol === 'admin') {
    document.getElementById('config-nombre-lab').value = nombreLaboratorio;
  }
  refrescarIconos();
}

document.getElementById('form-config-laboratorio').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nuevoNombre = document.getElementById('config-nombre-lab').value.trim();
  if (!nuevoNombre) return;

  const { error } = await sb.from('configuracion_lab').update({ valor: nuevoNombre }).eq('clave', 'nombre_laboratorio');
  if (error) { alert('No se pudo guardar: ' + error.message); return; }

  nombreLaboratorio = nuevoNombre;
  document.getElementById('marca-nombre-lab').textContent = nombreLaboratorio;
  const aviso = document.getElementById('config-lab-guardado');
  aviso.classList.remove('hidden');
  setTimeout(() => aviso.classList.add('hidden'), 2500);
});

// ============================================================
// 10. CUENTAS (dar de alta y eliminar) — solo administrador
// ============================================================

async function renderizarCuentas() {
  const cont = document.getElementById('lista-cuentas-ui');
  cont.innerHTML = `<li class="text-sm text-muted py-4 text-center">Cargando...</li>`;

  const { data, error } = await sb.from('profiles').select('id,nombre,correo,rol').order('creado_en');
  mostrarAvisoSinConexion(!!error);
  listaCuentas = data || [];

  const totalAdmins = listaCuentas.filter(c => c.rol === 'admin').length;
  cont.innerHTML = '';

  listaCuentas.forEach(cuenta => {
    const soyYo = sesion && sesion.id === cuenta.id;
    const esUltimoAdmin = cuenta.rol === 'admin' && totalAdmins <= 1;
    const puedeEliminar = !soyYo && !esUltimoAdmin;

    let motivo = '';
    if (soyYo) motivo = 'No puedes eliminar la cuenta con la que iniciaste sesión';
    else if (esUltimoAdmin) motivo = 'Debe quedar al menos un administrador';

    const li = document.createElement('li');
    li.className = "flex items-center justify-between gap-3 rounded-xl border border-line p-3";
    li.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 shrink-0 rounded-full bg-brand-soft text-brand-ink font-semibold text-sm flex items-center justify-center">
          ${esc(cuenta.nombre.charAt(0).toUpperCase())}
        </div>
        <div class="min-w-0">
          <p class="text-sm font-semibold truncate">${esc(cuenta.nombre)}${soyYo ? ' <span class="text-xs text-muted font-normal">(tú)</span>' : ''}</p>
          <p class="text-xs text-muted truncate">${esc(cuenta.correo)}</p>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="badge ${cuenta.rol === 'admin' ? 'badge-brand' : 'badge-neutral'}">${cuenta.rol === 'admin' ? 'Administrador' : 'Editor'}</span>
        ${puedeEliminar ? `
        <button onclick="eliminarCuenta('${cuenta.id}')" title="Eliminar cuenta" aria-label="Eliminar cuenta de ${esc(cuenta.nombre)}" class="btn btn-ghost btn-square btn-danger">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>` : `
        <span title="${motivo}" class="p-2 text-subtle">
          <i data-lucide="lock" class="w-4 h-4"></i>
        </span>`}
      </div>
    `;
    cont.appendChild(li);
  });

  refrescarIconos();
}

document.getElementById('form-nueva-cuenta').addEventListener('submit', async (e) => {
  e.preventDefault();
  document.getElementById('cuenta-error').classList.add('hidden');

  const nombre = document.getElementById('cuenta-nombre').value.trim();
  const correo = document.getElementById('cuenta-usuario').value.trim();
  const clave = document.getElementById('cuenta-clave').value;
  const rol = document.getElementById('cuenta-rol').value;
  const boton = e.target.querySelector('button[type=submit]');

  boton.disabled = true;
  const resultado = await llamarFuncionCuentas({ accion: 'crear', nombre, correo, clave, rol });
  boton.disabled = false;

  if (resultado.error) {
    document.getElementById('cuenta-error-texto').textContent = resultado.error;
    document.getElementById('cuenta-error').classList.remove('hidden');
    return;
  }

  document.getElementById('form-nueva-cuenta').reset();
  await renderizarCuentas();
});

async function eliminarCuenta(id) {
  const cuenta = listaCuentas.find(c => c.id === id);
  if (!cuenta) return;
  if (!confirm(`¿Eliminar la cuenta de ${cuenta.nombre} (${cuenta.correo})?`)) return;

  const resultado = await llamarFuncionCuentas({ accion: 'eliminar', id });
  if (resultado.error) { alert(resultado.error); return; }
  await renderizarCuentas();
}

// ============================================================
// TECLA ESCAPE Y ARRANQUE
// ============================================================

document.addEventListener('keydown', (e) => {
  const abierto = id => !document.getElementById(id).classList.contains('hidden');

  if (e.key === 'Escape') {
    if (abierto('modal-software-pc')) cerrarModalSoftwarePC();
    else if (abierto('modal-pc')) cerrarModalPC();
    else if (abierto('modal-catalogo-software')) cerrarModalCatalogoSoftware();
    else cerrarMenu();
    return;
  }

  // Los atajos "/" y "N" no deben interferir mientras se escribe en un campo,
  // ni mientras hay un modal abierto encima.
  const escribiendo = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  const hayModalAbierto = abierto('modal-pc') || abierto('modal-software-pc') || abierto('modal-catalogo-software');
  if (escribiendo || hayModalAbierto || !sesion) return;

  if (e.key === '/' && _ventanaActual === 'pcs') {
    e.preventDefault();
    document.getElementById('input-busqueda').focus();
  } else if ((e.key === 'n' || e.key === 'N') && _ventanaActual === 'pcs') {
    e.preventDefault();
    abrirModalPC();
  }
});

iniciarApp();
