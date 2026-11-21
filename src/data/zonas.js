'use strict';

/**
 * Zonas de riesgo de San Juan de Lurigancho.
 * DATOS SIMULADOS CON FINES ACADÉMICOS: las coordenadas son aproximadas y los
 * niveles de riesgo no provienen de una fuente oficial.
 *
 * nivel: alto | medio | bajo
 * franjas: manana (06-12) | tarde (12-18) | noche (18-24) | madrugada (00-06)
 */
const ZONAS = [
  { id: 1, nombre: 'Paradero Caja de Agua (Av. Próceres)', lat: -12.0275, lng: -77.0125, radio: 400, nivel: 'alto', delitos: ['robo', 'asalto_transporte'], franjas: ['noche', 'madrugada'] },
  { id: 2, nombre: 'Zárate - Av. Gran Chimú', lat: -12.0245, lng: -77.0005, radio: 450, nivel: 'alto', delitos: ['robo', 'microcomercializacion'], franjas: ['tarde', 'noche'] },
  { id: 3, nombre: 'Campoy - Av. Malecón Checa', lat: -12.0210, lng: -76.9750, radio: 500, nivel: 'medio', delitos: ['robo', 'pandillaje'], franjas: ['noche'] },
  { id: 4, nombre: 'Mangomarca', lat: -12.0050, lng: -76.9900, radio: 400, nivel: 'medio', delitos: ['robo'], franjas: ['noche', 'madrugada'] },
  { id: 5, nombre: 'Estación Los Jardines (Línea 1)', lat: -11.9970, lng: -77.0080, radio: 350, nivel: 'alto', delitos: ['robo', 'asalto_transporte'], franjas: ['manana', 'noche'] },
  { id: 6, nombre: 'Canto Rey', lat: -11.9850, lng: -77.0040, radio: 450, nivel: 'medio', delitos: ['extorsion', 'robo'], franjas: ['tarde', 'noche'] },
  { id: 7, nombre: 'Huáscar - Av. Central', lat: -11.9600, lng: -77.0000, radio: 500, nivel: 'alto', delitos: ['extorsion', 'pandillaje', 'robo'], franjas: ['noche', 'madrugada'] },
  { id: 8, nombre: 'Estación Bayóvar (Línea 1)', lat: -11.9550, lng: -76.9910, radio: 400, nivel: 'alto', delitos: ['asalto_transporte', 'robo'], franjas: ['manana', 'noche'] },
  { id: 9, nombre: '10 de Octubre', lat: -11.9550, lng: -76.9750, radio: 500, nivel: 'medio', delitos: ['microcomercializacion', 'pandillaje'], franjas: ['noche'] },
  { id: 10, nombre: 'Motupe', lat: -11.9450, lng: -76.9850, radio: 450, nivel: 'medio', delitos: ['extorsion'], franjas: ['tarde', 'noche'] },
  { id: 11, nombre: 'Montenegro', lat: -11.9400, lng: -76.9750, radio: 500, nivel: 'bajo', delitos: ['robo'], franjas: ['noche'] },
  { id: 12, nombre: 'Canto Grande - Av. Wiesse', lat: -11.9720, lng: -77.0030, radio: 400, nivel: 'bajo', delitos: ['robo'], franjas: ['madrugada'] }
];

/** Rectángulo aproximado que contiene el distrito (para validar coordenadas). */
const LIMITES_SJL = { latMin: -12.05, latMax: -11.90, lngMin: -77.05, lngMax: -76.93 };

const TIPOS_DELITO = ['robo', 'asalto_transporte', 'extorsion', 'microcomercializacion', 'pandillaje', 'otro'];
const FRANJAS = ['manana', 'tarde', 'noche', 'madrugada'];
const COMISARIAS = ['Zárate', 'Canto Rey', 'Bayóvar', 'Huáscar', 'Mariscal Cáceres', 'Caja de Agua', 'Santa Elizabeth', 'La Huayrona'];

module.exports = { ZONAS, LIMITES_SJL, TIPOS_DELITO, FRANJAS, COMISARIAS };
