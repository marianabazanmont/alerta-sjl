'use strict';

const request = require('supertest');
const app = require('../src/app');
const store = require('../src/store');

const reporteValido = { tipo: 'extorsion', lat: -11.96, lng: -77.0, descripcion: 'Cobro de cupos a mototaxistas en el paradero' };

async function tokenOperador() {
  const res = await request(app).post('/api/auth/login').send({ usuario: 'operador', password: 'Operador#2026' });
  return res.body.token;
}

beforeEach(() => store.reiniciar());

describe('Pruebas de integración - API', () => {
  test('GET /api/health responde ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('ok');
  });

  test('envía cabeceras de seguridad (Helmet) y oculta X-Powered-By', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('sirve el frontend en la raíz', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('AlertaSJL');
  });

  describe('Épica 1 - Zonas de riesgo', () => {
    test('lista las zonas de riesgo', async () => {
      const res = await request(app).get('/api/zonas');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(10);
    });

    test('filtra por tipo de delito y franja horaria', async () => {
      const res = await request(app).get('/api/zonas?tipo=extorsion&franja=noche');
      expect(res.status).toBe(200);
      res.body.forEach((z) => {
        expect(z.delitos).toContain('extorsion');
        expect(z.franjas).toContain('noche');
      });
    });

    test('rechaza un filtro inválido', async () => {
      expect((await request(app).get('/api/zonas?tipo=xyz')).status).toBe(400);
    });

    test('devuelve el detalle de una zona y 404 si no existe', async () => {
      expect((await request(app).get('/api/zonas/1')).body.nombre).toBeDefined();
      expect((await request(app).get('/api/zonas/999')).status).toBe(404);
    });

    test('alerta de cercanía cuando el usuario está en una zona de alto riesgo', async () => {
      const res = await request(app).get('/api/zonas/cercanas?lat=-12.0275&lng=-77.0125');
      expect(res.status).toBe(200);
      expect(res.body.alerta).toBe(true);
    });
  });

  describe('Épica 2 - Reportes ciudadanos', () => {
    test('registra un reporte anónimo válido (201)', async () => {
      const res = await request(app).post('/api/reportes').send(reporteValido);
      expect(res.status).toBe(201);
      expect(res.body.estado).toBe('nuevo');
      expect(res.body.contacto).toBeUndefined();
    });

    test('rechaza un reporte inválido (400)', async () => {
      const res = await request(app).post('/api/reportes').send({ tipo: 'robo' });
      expect(res.status).toBe(400);
      expect(res.body.errores.length).toBeGreaterThan(0);
    });

    test('rechaza JSON mal formado sin exponer detalles internos', async () => {
      const res = await request(app).post('/api/reportes').set('Content-Type', 'application/json').send('{malo');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('JSON mal formado');
    });

    test('la lista pública nunca expone el contacto del denunciante', async () => {
      await request(app).post('/api/reportes').send({ ...reporteValido, anonimo: false, contacto: '987654321' });
      const res = await request(app).get('/api/reportes');
      expect(JSON.stringify(res.body)).not.toContain('987654321');
    });
  });

  describe('Épica 4 - Autenticación y control de acceso', () => {
    test('login correcto devuelve un JWT', async () => {
      expect(await tokenOperador()).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    });

    test('login con contraseña incorrecta devuelve 401', async () => {
      const res = await request(app).post('/api/auth/login').send({ usuario: 'operador', password: 'mala' });
      expect(res.status).toBe(401);
    });

    test('la bandeja de serenazgo exige token (401) y rechaza tokens falsos', async () => {
      expect((await request(app).get('/api/admin/reportes')).status).toBe(401);
      const res = await request(app).get('/api/admin/reportes').set('Authorization', 'Bearer token.falso.123');
      expect(res.status).toBe(401);
    });
  });

  describe('Épica 3 - Gestión de incidentes', () => {
    test('el operador ve la bandeja con datos de contacto', async () => {
      const t = await tokenOperador();
      const res = await request(app).get('/api/admin/reportes').set('Authorization', `Bearer ${t}`);
      expect(res.status).toBe(200);
      expect(res.body[0]).toHaveProperty('historial');
    });

    test('cambia el estado siguiendo el flujo y registra el historial', async () => {
      const t = await tokenOperador();
      const res = await request(app).patch('/api/admin/reportes/1/estado').set('Authorization', `Bearer ${t}`).send({ estado: 'en_atencion' });
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('en_atencion');
      expect(res.body.historial.at(-1).usuario).toBe('operador');
    });

    test('rechaza una transición de estado inválida (422)', async () => {
      const t = await tokenOperador();
      const res = await request(app).patch('/api/admin/reportes/1/estado').set('Authorization', `Bearer ${t}`).send({ estado: 'atendido' });
      expect(res.status).toBe(422);
    });

    test('deriva un reporte a una comisaría válida', async () => {
      const t = await tokenOperador();
      const ok = await request(app).patch('/api/admin/reportes/2/derivar').set('Authorization', `Bearer ${t}`).send({ comisaria: 'Bayóvar' });
      expect(ok.body.comisaria).toBe('Bayóvar');
      const mal = await request(app).patch('/api/admin/reportes/2/derivar').set('Authorization', `Bearer ${t}`).send({ comisaria: 'Inventada' });
      expect(mal.status).toBe(400);
    });
  });

  describe('Épica 5 - Analítica', () => {
    test('devuelve estadísticas por tipo, estado y franja', async () => {
      const res = await request(app).get('/api/estadisticas');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(4);
      expect(res.body).toHaveProperty('porTipo');
      expect(res.body).toHaveProperty('porFranja');
    });
  });
});
