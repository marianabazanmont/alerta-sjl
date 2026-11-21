/* global L */
'use strict';

const COLORES = { alto: '#c0392b', medio: '#e67e22', bajo: '#f1c40f' };
const NOMBRES = new Map(Object.entries({
  robo: 'Robo al paso', asalto_transporte: 'Asalto en transporte', extorsion: 'Extorsión',
  microcomercializacion: 'Microcomercialización de drogas', pandillaje: 'Pandillaje', otro: 'Otro',
  nuevo: 'Nuevo', en_atencion: 'En atención', atendido: 'Atendido', descartado: 'Descartado',
  manana: 'Mañana', tarde: 'Tarde', noche: 'Noche', madrugada: 'Madrugada'
}));
const $ = (id) => document.getElementById(id);
const nombre = (k) => NOMBRES.get(k) || k;
let token = sessionStorage.getItem('token');
let catalogos = { tipos: [], estados: [], comisarias: [] };

/* Crea un elemento con texto seguro (textContent evita XSS) */
function el(tag, texto, clase) {
  const e = document.createElement(tag);
  if (texto !== undefined) e.textContent = texto;
  if (clase) e.className = clase;
  return e;
}

async function api(url, opciones = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...opciones, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || (data.errores || []).join('. ') || 'Error');
  return data;
}

/* ---------- Pestañas ---------- */
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.remove('activo'));
  document.querySelectorAll('.seccion').forEach((x) => x.classList.remove('activa'));
  b.classList.add('activo');
  $(b.dataset.tab).classList.add('activa');
  if (b.dataset.tab === 'mapa') setTimeout(() => mapa.invalidateSize(), 50);
  if (b.dataset.tab === 'estadisticas') cargarEstadisticas();
  if (b.dataset.tab === 'panel' && token) cargarBandeja();
}));

/* ---------- Mapa ---------- */
const mapa = L.map('map').setView([-11.985, -76.995], 12);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap'
}).addTo(mapa);
const capaZonas = L.layerGroup().addTo(mapa);
const capaReportes = L.layerGroup().addTo(mapa);
let marcadorNuevo = null;

async function cargarZonas() {
  const params = new URLSearchParams();
  if ($('filtro-tipo').value) params.set('tipo', $('filtro-tipo').value);
  if ($('filtro-franja').value) params.set('franja', $('filtro-franja').value);
  const zonas = await api(`/api/zonas?${params}`);
  capaZonas.clearLayers();
  zonas.forEach((z) => {
    const popup = el('div');
    popup.append(el('b', z.nombre), el('br'), el('span', `Riesgo: ${z.nivel.toUpperCase()}`), el('br'),
      el('span', `Delitos: ${z.delitos.map(nombre).join(', ')}`), el('br'),
      el('span', `Horario crítico: ${z.franjas.map(nombre).join(', ')}`));
    L.circle([z.lat, z.lng], { radius: z.radio, color: COLORES[z.nivel], fillOpacity: 0.35 })
      .bindPopup(popup).addTo(capaZonas);
  });
}

async function cargarReportes() {
  const reportes = await api('/api/reportes');
  capaReportes.clearLayers();
  const ul = $('lista-reportes');
  ul.replaceChildren();
  reportes.forEach((r) => {
    L.circleMarker([r.lat, r.lng], { radius: 6, color: '#12233d', fillOpacity: 0.9 })
      .bindPopup(el('span', `${nombre(r.tipo)}: ${r.descripcion}`)).addTo(capaReportes);
    const li = el('li');
    li.append(el('span', nombre(r.tipo), 'badge'), el('span', nombre(r.estado), 'badge'),
      el('span', r.descripcion), el('br'), el('small', new Date(r.fecha).toLocaleString('es-PE')));
    ul.append(li);
  });
}

mapa.on('click', (e) => {
  $('r-lat').value = e.latlng.lat.toFixed(5);
  $('r-lng').value = e.latlng.lng.toFixed(5);
  if (marcadorNuevo) marcadorNuevo.remove();
  marcadorNuevo = L.marker(e.latlng).addTo(mapa).bindPopup('Ubicación del reporte. Ve a la pestaña "Reportar".').openPopup();
});

$('filtro-tipo').addEventListener('change', cargarZonas);
$('filtro-franja').addEventListener('change', cargarZonas);

/* Alerta de cercanía a zona de alto riesgo */
$('btn-ubicacion').addEventListener('click', () => {
  if (!navigator.geolocation) return mostrarAlerta('Tu navegador no permite geolocalización');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude: lat, longitude: lng } = pos.coords;
    $('r-lat').value = lat.toFixed(5);
    $('r-lng').value = lng.toFixed(5);
    try {
      const r = await api(`/api/zonas/cercanas?lat=${lat}&lng=${lng}`);
      mostrarAlerta(r.alerta
        ? `⚠ Estás en una zona de ALTO riesgo: ${r.zonas.map((z) => z.nombre).join(', ')}. Toma precauciones.`
        : 'No estás dentro de una zona de alto riesgo registrada.');
    } catch (err) { mostrarAlerta(err.message); }
  }, () => mostrarAlerta('No se pudo obtener tu ubicación'));
});

function mostrarAlerta(texto) {
  const a = $('alerta-cercania');
  a.textContent = texto;
  a.classList.remove('oculto');
  setTimeout(() => a.classList.add('oculto'), 8000);
}

/* ---------- Reportar ---------- */
$('r-anonimo').addEventListener('change', () => $('lbl-contacto').classList.toggle('oculto', $('r-anonimo').checked));

$('form-reporte').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('msg-reporte');
  const cuerpo = {
    tipo: $('r-tipo').value, lat: Number($('r-lat').value), lng: Number($('r-lng').value),
    descripcion: $('r-desc').value, anonimo: $('r-anonimo').checked
  };
  if (!cuerpo.anonimo) cuerpo.contacto = $('r-contacto').value;
  try {
    const r = await api('/api/reportes', { method: 'POST', body: JSON.stringify(cuerpo) });
    msg.textContent = `Reporte #${r.id} registrado. Gracias por ayudar a tu comunidad.`;
    msg.className = 'msg ok';
    e.target.reset();
    if (marcadorNuevo) marcadorNuevo.remove();
    cargarReportes();
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'msg error';
  }
});

/* ---------- Estadísticas ---------- */
async function cargarEstadisticas() {
  const s = await api('/api/estadisticas');
  const cont = $('stats');
  cont.replaceChildren();
  const tarjeta = (titulo, datos) => {
    const c = el('div', undefined, 'card');
    c.append(el('h3', titulo));
    const max = Math.max(1, ...Object.values(datos));
    Object.entries(datos).forEach(([k, n]) => {
      c.append(el('div', `${nombre(k)}: ${n}`));
      const barra = el('div', undefined, 'barra');
      barra.style.width = `${(n / max) * 100}%`;
      c.append(barra);
    });
    return c;
  };
  const total = el('div', undefined, 'card');
  total.append(el('h3', 'Total de reportes'), el('p', String(s.total)));
  cont.append(total, tarjeta('Por tipo de delito', s.porTipo), tarjeta('Por franja horaria', s.porFranja), tarjeta('Por estado', s.porEstado));
}

/* ---------- Panel serenazgo ---------- */
function actualizarSesion() {
  $('form-login').classList.toggle('oculto', Boolean(token));
  $('bandeja').classList.toggle('oculto', !token);
}

$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ usuario: $('l-user').value, password: $('l-pass').value }) });
    token = r.token;
    sessionStorage.setItem('token', token);
    $('msg-login').textContent = '';
    actualizarSesion();
    cargarBandeja();
  } catch (err) {
    $('msg-login').textContent = err.message;
    $('msg-login').className = 'msg error';
  }
});

$('btn-salir').addEventListener('click', () => {
  token = null;
  sessionStorage.removeItem('token');
  actualizarSesion();
});

$('f-estado').addEventListener('change', cargarBandeja);

async function cargarBandeja() {
  try {
    const q = $('f-estado').value ? `?estado=${$('f-estado').value}` : '';
    const lista = await api(`/api/admin/reportes${q}`);
    const tbody = $('tabla-reportes');
    tbody.replaceChildren();
    lista.forEach((r) => {
      const tr = el('tr');
      tr.append(el('td', String(r.id)), el('td', new Date(r.fecha).toLocaleString('es-PE')), el('td', nombre(r.tipo)),
        el('td', r.descripcion), el('td', r.anonimo ? 'Anónimo' : r.contacto));
      const tdEstado = el('td');
      const selEstado = el('select');
      catalogos.estados.forEach((s) => {
        const o = el('option', nombre(s)); o.value = s; o.selected = s === r.estado; selEstado.append(o);
      });
      selEstado.addEventListener('change', () => cambiar(`/api/admin/reportes/${r.id}/estado`, { estado: selEstado.value }));
      tdEstado.append(selEstado);
      const tdCom = el('td');
      const selCom = el('select');
      const vacio = el('option', '— Derivar —'); vacio.value = ''; selCom.append(vacio);
      catalogos.comisarias.forEach((c) => {
        const o = el('option', c); o.value = c; o.selected = c === r.comisaria; selCom.append(o);
      });
      selCom.addEventListener('change', () => selCom.value && cambiar(`/api/admin/reportes/${r.id}/derivar`, { comisaria: selCom.value }));
      tdCom.append(selCom);
      tr.append(tdEstado, tdCom);
      tbody.append(tr);
    });
  } catch (err) {
    if (/Token/.test(err.message)) { token = null; sessionStorage.removeItem('token'); actualizarSesion(); }
    $('msg-login').textContent = err.message;
  }
}

async function cambiar(url, cuerpo) {
  try {
    await api(url, { method: 'PATCH', body: JSON.stringify(cuerpo) });
  } catch (err) {
    mostrarAlerta(err.message);
  }
  cargarBandeja();
}

/* ---------- Inicio ---------- */
(async function iniciar() {
  catalogos = await api('/api/catalogos');
  catalogos.tipos.forEach((t) => {
    const o1 = el('option', nombre(t)); o1.value = t; $('filtro-tipo').append(o1);
    const o2 = el('option', nombre(t)); o2.value = t; $('r-tipo').append(o2);
  });
  catalogos.estados.forEach((s) => { const o = el('option', nombre(s)); o.value = s; $('f-estado').append(o); });
  actualizarSesion();
  cargarZonas();
  cargarReportes();
}());
