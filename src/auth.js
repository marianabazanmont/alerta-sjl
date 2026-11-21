'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const esProduccion = process.env.NODE_ENV === 'production';

// En producción los secretos DEBEN venir de variables de entorno (nunca del código).
if (esProduccion && (!process.env.JWT_SECRET || !process.env.OPERADOR_PASSWORD || !process.env.ADMIN_PASSWORD)) {
  throw new Error('Faltan variables de entorno: JWT_SECRET, OPERADOR_PASSWORD y ADMIN_PASSWORD son obligatorias en producción');
}

// Fuera de producción, si no hay JWT_SECRET se genera uno aleatorio en cada arranque
// (así no queda ningún secreto escrito en el código).
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const EXPIRA = '2h';

// Usuarios de demostración; las contraseñas se guardan solo como hash bcrypt.
// Las contraseñas por defecto solo aplican en desarrollo/pruebas; en producción
// el arranque falla si no vienen de variables de entorno (ver validación arriba).
const USUARIOS = [
  { usuario: 'operador', rol: 'operador', hash: bcrypt.hashSync(process.env.OPERADOR_PASSWORD || 'Operador#2026', 10) },
  { usuario: 'admin', rol: 'admin', hash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Admin#2026', 10) }
];
const HASH_FALSO = bcrypt.hashSync('usuario-inexistente', 10);

async function login(usuario, password) {
  if (typeof usuario !== 'string' || typeof password !== 'string') return null;
  const u = USUARIOS.find((x) => x.usuario === usuario);
  // Se compara aunque el usuario no exista para no revelar qué usuarios existen (timing).
  const ok = await bcrypt.compare(password, u ? u.hash : HASH_FALSO);
  if (!u || !ok) return null;
  return jwt.sign({ sub: u.usuario, rol: u.rol }, JWT_SECRET, { expiresIn: EXPIRA });
}

/** Middleware: exige un token JWT válido y uno de los roles indicados. */
function requiereRol(...roles) {
  return (req, res, next) => {
    const cabecera = req.headers.authorization || '';
    const [tipo, token] = cabecera.split(' ');
    if (tipo !== 'Bearer' || !token) return res.status(401).json({ error: 'Token requerido' });
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (!roles.includes(payload.rol)) return res.status(403).json({ error: 'Permisos insuficientes' });
      req.usuario = payload;
      return next();
    } catch {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
  };
}

module.exports = { login, requiereRol };
