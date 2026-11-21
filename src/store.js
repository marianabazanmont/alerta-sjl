'use strict';

/**
 * Almacenamiento en memoria de los reportes (suficiente para la demo académica).
 * En producción se reemplazaría por PostgreSQL (p. ej. Render Postgres o Supabase).
 */
let reportes = [];
let siguienteId = 1;

const SEMILLA = [
  { tipo: 'robo', lat: -12.0270, lng: -77.0120, descripcion: 'Robo de celular al paso en el paradero', horasAtras: 3 },
  { tipo: 'asalto_transporte', lat: -11.9555, lng: -76.9905, descripcion: 'Asalto dentro de una combi cerca a la estación', horasAtras: 7 },
  { tipo: 'extorsion', lat: -11.9605, lng: -77.0010, descripcion: 'Bodega recibió mensajes extorsivos por WhatsApp', horasAtras: 20 },
  { tipo: 'microcomercializacion', lat: -12.0240, lng: -77.0000, descripcion: 'Venta de drogas en la esquina del parque por las noches', horasAtras: 30 }
];

function reiniciar() {
  reportes = [];
  siguienteId = 1;
  const ahora = Date.now();
  for (const s of SEMILLA) {
    crear({ tipo: s.tipo, lat: s.lat, lng: s.lng, descripcion: s.descripcion, anonimo: true, contacto: null }, new Date(ahora - s.horasAtras * 3600000));
  }
}

function crear(datos, fecha = new Date()) {
  const reporte = {
    id: siguienteId++,
    ...datos,
    estado: 'nuevo',
    comisaria: null,
    fecha: fecha.toISOString(),
    historial: [{ estado: 'nuevo', fecha: fecha.toISOString(), usuario: 'ciudadano' }]
  };
  reportes.push(reporte);
  return reporte;
}

function listar() {
  return [...reportes].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function obtener(id) {
  return reportes.find((r) => r.id === id) || null;
}

/** Vista pública: nunca expone datos de contacto ni el historial interno. */
function vistaPublica(r) {
  return { id: r.id, tipo: r.tipo, lat: r.lat, lng: r.lng, descripcion: r.descripcion, estado: r.estado, fecha: r.fecha };
}

reiniciar();

module.exports = { reiniciar, crear, listar, obtener, vistaPublica };
