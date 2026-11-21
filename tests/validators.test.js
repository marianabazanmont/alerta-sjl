'use strict';

const v = require('../src/validators');

describe('Pruebas unitarias - validadores', () => {
  const valido = { tipo: 'robo', lat: -12.0, lng: -77.0, descripcion: 'Robo de celular en el paradero' };

  test('acepta un reporte válido y lo marca anónimo por defecto', () => {
    const r = v.validarReporte(valido);
    expect(r.ok).toBe(true);
    expect(r.datos.anonimo).toBe(true);
    expect(r.datos.contacto).toBeNull();
  });

  test('rechaza un tipo de incidente que no existe', () => {
    expect(v.validarReporte({ ...valido, tipo: 'hackeo' }).ok).toBe(false);
  });

  test('rechaza coordenadas fuera de San Juan de Lurigancho (Miraflores)', () => {
    const r = v.validarReporte({ ...valido, lat: -12.1211, lng: -77.0297 });
    expect(r.ok).toBe(false);
    expect(r.errores).toContain('La ubicación debe estar dentro de San Juan de Lurigancho');
  });

  test('rechaza coordenadas que no son numéricas', () => {
    expect(v.dentroDeSJL('-12', '-77')).toBe(false);
    expect(v.dentroDeSJL(NaN, -77)).toBe(false);
  });

  test('rechaza descripciones muy cortas o muy largas', () => {
    expect(v.validarReporte({ ...valido, descripcion: 'corto' }).ok).toBe(false);
    expect(v.validarReporte({ ...valido, descripcion: 'x'.repeat(281) }).ok).toBe(false);
  });

  test('elimina etiquetas HTML de la descripción (anti-XSS)', () => {
    const r = v.validarReporte({ ...valido, descripcion: '<script>alert(1)</script>Robo en la esquina del mercado' });
    expect(r.ok).toBe(true);
    expect(r.datos.descripcion).not.toMatch(/<|>/);
  });

  test('exige un celular válido cuando el reporte NO es anónimo', () => {
    expect(v.validarReporte({ ...valido, anonimo: false }).ok).toBe(false);
    expect(v.validarReporte({ ...valido, anonimo: false, contacto: '12345' }).ok).toBe(false);
    const ok = v.validarReporte({ ...valido, anonimo: false, contacto: '987654321' });
    expect(ok.ok).toBe(true);
    expect(ok.datos.contacto).toBe('987654321');
  });

  test('máquina de estados: solo permite transiciones válidas', () => {
    expect(v.transicionValida('nuevo', 'en_atencion')).toBe(true);
    expect(v.transicionValida('en_atencion', 'atendido')).toBe(true);
    expect(v.transicionValida('nuevo', 'atendido')).toBe(false);
    expect(v.transicionValida('atendido', 'nuevo')).toBe(false);
    expect(v.transicionValida('inexistente', 'nuevo')).toBe(false);
  });

  test('calcula la franja horaria en hora de Lima (UTC-5)', () => {
    expect(v.franjaDeFecha('2026-11-21T03:00:00Z')).toBe('noche'); // 22:00 Lima
    expect(v.franjaDeFecha('2026-11-21T08:00:00Z')).toBe('madrugada'); // 03:00 Lima
    expect(v.franjaDeFecha('2026-11-21T14:00:00Z')).toBe('manana'); // 09:00 Lima
    expect(v.franjaDeFecha('2026-11-21T20:00:00Z')).toBe('tarde'); // 15:00 Lima
  });

  test('Haversine: distancia cero y distancia conocida aproximada', () => {
    expect(v.distanciaMetros(-12, -77, -12, -77)).toBe(0);
    const d = v.distanciaMetros(-12.0, -77.0, -12.01, -77.0); // ~1.11 km
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1125);
  });

  test('valida comisarías y franjas del catálogo', () => {
    expect(v.esComisariaValida('Zárate')).toBe(true);
    expect(v.esComisariaValida('Miraflores')).toBe(false);
    expect(v.esFranjaValida('noche')).toBe(true);
    expect(v.esFranjaValida('almuerzo')).toBe(false);
  });
});
