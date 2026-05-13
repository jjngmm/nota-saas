const { verifyToken } = require('../utils/auth');

// ==========================================
// MIDDLEWARE: Verificar Token JWT
// ==========================================
function authMiddleware(req, res, next) {
  // Obtener token del header: "Bearer token"
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Missing or invalid authorization header',
      message: 'Send: Authorization: Bearer <token>'
    });
  }

  const token = authHeader.substring(7); // Remover "Bearer "
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ 
      error: 'Invalid or expired token'
    });
  }

  // Guardar info del usuario en el request
  req.user = decoded;
  next();
}

module.exports = authMiddleware;