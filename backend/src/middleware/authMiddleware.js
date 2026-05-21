const { verifyToken } = require('../utils/auth');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Missing or invalid authorization header',
      message: 'Send: Authorization: Bearer <token>'
    });
  }
  
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ 
      error: 'Invalid or expired token'
    });
  }
  
  // Log para debuggear
  console.log('Decoded JWT:', decoded);
  
  req.user = decoded;
  next();
}

module.exports = authMiddleware;
