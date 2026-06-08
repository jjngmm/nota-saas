// Middleware de control de acceso por rol
// Uso: router.get('/ruta', authMiddleware, requireRole('admin'), handler)
//      router.get('/ruta', authMiddleware, requireRole('admin','doctor'), handler)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user?.role) {
      return res.status(403).json({ error: 'Sin rol asignado' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'No tienes permiso para realizar esta acción',
        required: roles,
        current: req.user.role,
      });
    }
    next();
  };
}

module.exports = requireRole;
