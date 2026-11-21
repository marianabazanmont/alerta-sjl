# AlertaSJL

Mapa de zonas de riesgo y reportes ciudadanos de inseguridad para **San Juan de Lurigancho**.
Proyecto académico – Proyecto Final de Carrera III (USIL), Práctica Calificada 2.

> Las zonas y niveles de riesgo son **datos simulados con fines académicos**.

## Funcionalidades (por épica)

| Épica | Funcionalidad | Endpoint |
|---|---|---|
| E1 Mapa de zonas de riesgo | Mapa con zonas por nivel, filtros por tipo y franja horaria, detalle de zona | `GET /api/zonas`, `GET /api/zonas/:id` |
| E2 Reportes ciudadanos | Reporte anónimo o con contacto, ubicación con clic en el mapa, lista de recientes | `POST /api/reportes`, `GET /api/reportes` |
| E3 Gestión de incidentes | Bandeja del operador, cambio de estado (máquina de estados), derivación a comisaría | `GET /api/admin/reportes`, `PATCH .../estado`, `PATCH .../derivar` |
| E4 Autenticación y seguridad | Login con JWT, roles operador/admin, contraseñas con bcrypt, rate limiting | `POST /api/auth/login` |
| E5 Analítica y alertas | Estadísticas por tipo/estado/franja, alerta de cercanía a zona de alto riesgo | `GET /api/estadisticas`, `GET /api/zonas/cercanas` |

## Stack

- **Backend:** Node.js 20 + Express 5
- **Frontend:** HTML + CSS + JavaScript + Leaflet (OpenStreetMap), servido por el mismo Express
- **Seguridad en la app:** Helmet (CSP y cabeceras), express-rate-limit, JWT, bcrypt, validación y sanitización de entradas
- **Pruebas:** Jest (unitarias) + Supertest (integración), umbral de cobertura 80 %
- **CI/CD:** GitHub Actions · **SAST:** ESLint security + CodeQL · **SCA:** npm audit + Dependabot · **Secretos:** Gitleaks
- **Nube:** Render (Web Service, plan free) con `render.yaml` como infraestructura como código

## Ejecutar en local

```bash
npm install
npm test          # pruebas + cobertura
npm run lint      # linter + reglas de seguridad
npm start         # http://localhost:3000
```

Credenciales de demostración (solo desarrollo): `operador / Operador#2026`, `admin / Admin#2026`.
En producción se configuran con variables de entorno y la app no arranca sin ellas.

## Estrategia de ramas

```
feature/AS-xx-descripcion  ──PR──►  test  ──PR──►  main (producción)
```

- `main`: producción. Protegida: solo se actualiza por Pull Request con el pipeline en verde.
- `test`: integración y pruebas. Cada push ejecuta build, pruebas y seguridad, sin desplegar.
- Commits con formato *Conventional Commits* y clave de Jira: `feat(AS-7): registrar reporte ciudadano`.

## Pipeline (`.github/workflows/ci-cd.yml`)

| Etapa | Qué hace | Falla si… |
|---|---|---|
| Build | `npm ci` + ESLint con `eslint-plugin-security` (SAST ligero) | hay errores de lint |
| Test | Jest + Supertest, publica cobertura | falla una prueba o la cobertura baja de 80 % |
| Security | `npm audit --omit=dev --audit-level=high` (SCA) + Gitleaks (secretos) | hay vulnerabilidad alta/crítica o un secreto en el historial |
| Deploy | Solo en `main`: llama al Deploy Hook de Render y hace *smoke test* a `/api/health` | la app no responde sana |

Además `codeql.yml` ejecuta CodeQL (SAST semántico) en cada push y PR, y Dependabot propone actualizaciones semanales.

## Puesta en marcha paso a paso (≈ 20 min)

1. **GitHub:** crear el repositorio **público** `alerta-sjl` y subir el código:
   ```bash
   git init && git add . && git commit -m "chore(AS-1): estructura inicial del proyecto"
   git branch -M main
   git remote add origin https://github.com/<usuario>/alerta-sjl.git
   git push -u origin main
   git checkout -b test && git push -u origin test
   ```
2. **Render:** New → Web Service → conectar el repo → rama `main`, Build `npm ci --omit=dev`, Start `npm start`, plan Free.
   En *Environment* agregar `NODE_ENV=production`, `JWT_SECRET` (valor largo aleatorio), `OPERADOR_PASSWORD`, `ADMIN_PASSWORD`.
   En *Settings* poner **Auto-Deploy: Off** y copiar el **Deploy Hook**.
3. **Secretos en GitHub:** Settings → Secrets and variables → Actions
   - *Secret* `RENDER_DEPLOY_HOOK` = URL del Deploy Hook
   - *Variable* `APP_URL` = `https://alerta-sjl.onrender.com` (sin `/` final)
4. **Proteger `main`:** Settings → Branches → Add rule → `main` → *Require a pull request* + *Require status checks* (Build y lint, Pruebas automatizadas, Análisis de seguridad).
5. **Flujo de evidencia:** hacer un cambio en `test` → push (pipeline sin deploy) → abrir PR `test → main` → merge → pipeline con deploy → abrir la URL.

Render free "duerme" tras 15 min sin tráfico: abrir la URL un minuto antes de mostrarla.
