'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { ZONAS, TIPOS_DELITO, COMISARIAS } = require('./data/zonas');
const v = require('./validators');
const store = require('./store');
const { login, requiereRol } = require('./auth');

const app = express();
const esTest = process.env.NODE_ENV === 'test';

app.disable('x-powered-by');
app.set('trust proxy', 1); // detrás del proxy de Render

// Cabeceras de seguridad (CSP solo permite recursos propios y los mosaicos de OpenStreetMap)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https://tile.openstreetmap.org'],
        connectSrc: ["'self'"]
      }
    }
  })
);
app.use(express.json({ limit: '10kb' }));

// Limitación de peticiones: mitiga spam de reportes y fuerza bruta en el login
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, limit: esTest ? 10000 : 300, standardHeaders: 'draft-8', legacyHeaders: false }));
const limiteLogin = rateLimit({ windowMs: 60 * 1000, limit: esTest ? 10000 : 5, message: { error: 'Demasiados intentos, espere un minuto' } });
const limiteReportes = rateLimit({ windowMs: 60 * 1000, limit: esTest ? 10000 : 10, message: { error: 'Demasiados reportes, espere un minuto' } });

// Archivos estáticos (frontend) y Leaflet servido localmente (sin CDN externo)
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/vendor/leaflet', express.static(path.join(__dirname, '..', 'node_modules', 'leaflet', 'dist')));

// ---------- Salud ----------
app.get('/api/health', (req, res) => {
  res.json({ estado: 'ok', servicio: 'alerta-sjl', version: process.env.npm_package_version || '1.0.0' });
});

app.get('/api/catalogos', (req, res) => {
  res.json({ tipos: TIPOS_DELITO, estados: v.ESTADOS, comisarias: COMISARIAS });
});

// ---------- Épica 1: Mapa de zonas de riesgo ----------
app.get('/api/zonas', (req, res) => {
  const { tipo, franja, nivel } = req.query;
  if (tipo && !TIPOS_DELITO.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
  if (franja && !v.esFranjaValida(franja)) return res.status(400).json({ error: 'Franja inválida' });
  let zonas = ZONAS;
  if (tipo) zonas = zonas.filter((z) => z.delitos.includes(tipo));
  if (franja) zonas = zonas.filter((z) => z.franjas.includes(franja));
  if (nivel) zonas = zonas.filter((z) => z.nivel === nivel);
  return res.json(zonas);
});

app.get('/api/zonas/cercanas', (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!v.dentroDeSJL(lat, lng)) return res.status(400).json({ error: 'Coordenadas fuera de SJL' });
  const cercanas = ZONAS.filter((z) => v.distanciaMetros(lat, lng, z.lat, z.lng) <= z.radio);
  return res.json({ alerta: cercanas.some((z) => z.nivel === 'alto'), zonas: cercanas });
});

app.get('/api/zonas/:id', (req, res) => {
  const zona = ZONAS.find((z) => z.id === Number(req.params.id));
  if (!zona) return res.status(404).json({ error: 'Zona no encontrada' });
  return res.json(zona);
});

// ---------- Épica 2: Reportes ciudadanos ----------
app.get('/api/reportes', (req, res) => {
  res.json(store.listar().slice(0, 50).map(store.vistaPublica));
});

app.post('/api/reportes', limiteReportes, (req, res) => {
  const r = v.validarReporte(req.body);
  if (!r.ok) return res.status(400).json({ errores: r.errores });
  const reporte = store.crear(r.datos);
  return res.status(201).json(store.vistaPublica(reporte));
});

// ---------- Épica 4: Autenticación ----------
app.post('/api/auth/login', limiteLogin, async (req, res) => {
  const { usuario, password } = req.body || {};
  const token = await login(usuario, password);
  if (!token) return res.status(401).json({ error: 'Credenciales inválidas' });
  return res.json({ token });
});

// ---------- Épica 3: Gestión de incidentes (serenazgo / comisaría) ----------
const staff = requiereRol('operador', 'admin');

app.get('/api/admin/reportes', staff, (req, res) => {
  const { estado, tipo } = req.query;
  let lista = store.listar();
  if (estado) lista = lista.filter((r) => r.estado === estado);
  if (tipo) lista = lista.filter((r) => r.tipo === tipo);
  res.json(lista);
});

app.patch('/api/admin/reportes/:id/estado', staff, (req, res) => {
  const reporte = store.obtener(Number(req.params.id));
  if (!reporte) return res.status(404).json({ error: 'Reporte no encontrado' });
  const { estado } = req.body || {};
  if (!v.transicionValida(reporte.estado, estado)) {
    return res.status(422).json({ error: `No se puede pasar de "${reporte.estado}" a "${estado}"` });
  }
  reporte.estado = estado;
  reporte.historial.push({ estado, fecha: new Date().toISOString(), usuario: req.usuario.sub });
  return res.json(reporte);
});

app.patch('/api/admin/reportes/:id/derivar', staff, (req, res) => {
  const reporte = store.obtener(Number(req.params.id));
  if (!reporte) return res.status(404).json({ error: 'Reporte no encontrado' });
  const { comisaria } = req.body || {};
  if (!v.esComisariaValida(comisaria)) return res.status(400).json({ error: 'Comisaría inválida' });
  reporte.comisaria = comisaria;
  reporte.historial.push({ estado: reporte.estado, fecha: new Date().toISOString(), usuario: req.usuario.sub, nota: `Derivado a comisaría ${comisaria}` });
  return res.json(reporte);
});

// ---------- Épica 5: Analítica ----------
app.get('/api/estadisticas', (req, res) => {
  const lista = store.listar();
  const contar = (fn) => {
    const conteo = new Map();
    lista.forEach((r) => conteo.set(fn(r), (conteo.get(fn(r)) || 0) + 1));
    return Object.fromEntries(conteo);
  };
  res.json({
    total: lista.length,
    porTipo: contar((r) => r.tipo),
    porEstado: contar((r) => r.estado),
    porFranja: contar((r) => v.franjaDeFecha(r.fecha))
  });
});

// 404 para API y manejador de errores que no filtra detalles internos
app.use('/api', (req, res) => res.status(404).json({ error: 'Recurso no encontrado' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON mal formado' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Solicitud demasiado grande' });
  if (!esTest) console.error(err);
  return res.status(500).json({ error: 'Error interno' });
});

module.exports = app;
