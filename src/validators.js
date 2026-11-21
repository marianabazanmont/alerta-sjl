'use strict';

const { LIMITES_SJL, TIPOS_DELITO, FRANJAS, COMISARIAS } = require('./data/zonas');

const ESTADOS = ['nuevo', 'en_atencion', 'atendido', 'descartado'];

/** Transiciones de estado permitidas (máquina de estados del reporte). */
const TRANSICIONES = new Map([
  ['nuevo', ['en_atencion', 'descartado']],
  ['en_atencion', ['atendido', 'descartado']],
  ['atendido', []],
  ['descartado', []]
]);

/** Elimina etiquetas HTML y espacios extremos (mitiga XSS almacenado). */
function sanitizarTexto(texto) {
  return String(texto).replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
}

function dentroDeSJL(lat, lng) {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= LIMITES_SJL.latMin && lat <= LIMITES_SJL.latMax &&
    lng >= LIMITES_SJL.lngMin && lng <= LIMITES_SJL.lngMax
  );
}

/**
 * Valida el cuerpo de un nuevo reporte ciudadano.
 * @returns {{ ok: boolean, errores: string[], datos?: object }}
 */
function validarReporte(body) {
  const errores = [];
  if (!body || typeof body !== 'object') {
    return { ok: false, errores: ['Cuerpo de la solicitud inválido'] };
  }
  const { tipo, lat, lng, descripcion, anonimo, contacto } = body;

  if (!TIPOS_DELITO.includes(tipo)) errores.push('Tipo de incidente inválido');
  if (!dentroDeSJL(lat, lng)) errores.push('La ubicación debe estar dentro de San Juan de Lurigancho');

  const desc = typeof descripcion === 'string' ? sanitizarTexto(descripcion) : '';
  if (desc.length < 10 || desc.length > 280) errores.push('La descripción debe tener entre 10 y 280 caracteres');

  const esAnonimo = anonimo !== false; // por defecto anónimo (protege al denunciante)
  let telefono = null;
  if (!esAnonimo) {
    if (typeof contacto !== 'string' || !/^9\d{8}$/.test(contacto)) {
      errores.push('El contacto debe ser un celular peruano de 9 dígitos que empiece con 9');
    } else {
      telefono = contacto;
    }
  }

  if (errores.length) return { ok: false, errores };
  return { ok: true, errores: [], datos: { tipo, lat, lng, descripcion: desc, anonimo: esAnonimo, contacto: telefono } };
}

function transicionValida(estadoActual, nuevoEstado) {
  const permitidos = TRANSICIONES.get(estadoActual);
  return Boolean(permitidos) && permitidos.includes(nuevoEstado);
}

function esFranjaValida(franja) {
  return FRANJAS.includes(franja);
}

function esComisariaValida(nombre) {
  return COMISARIAS.includes(nombre);
}

/** Devuelve la franja horaria de una fecha (hora local de Lima, UTC-5). */
function franjaDeFecha(fecha) {
  const horaLima = (new Date(fecha).getUTCHours() + 24 - 5) % 24;
  if (horaLima < 6) return 'madrugada';
  if (horaLima < 12) return 'manana';
  if (horaLima < 18) return 'tarde';
  return 'noche';
}

/** Distancia en metros entre dos coordenadas (fórmula de Haversine). */
function distanciaMetros(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

module.exports = {
  ESTADOS,
  TRANSICIONES,
  sanitizarTexto,
  dentroDeSJL,
  validarReporte,
  transicionValida,
  esFranjaValida,
  esComisariaValida,
  franjaDeFecha,
  distanciaMetros
};
