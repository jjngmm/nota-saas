const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// ==========================================
// GENERAR TOKEN JWT
// ==========================================
function generateToken(userId, orgId, email) {
  return jwt.sign(
    { 
      userId, 
      orgId, 
      email,
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { expiresIn: '7d' } // Válido por 7 días
  );
}

// ==========================================
// VERIFICAR TOKEN JWT
// ==========================================
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// ==========================================
// HASHEAR CONTRASEÑA
// ==========================================
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// ==========================================
// COMPARAR CONTRASEÑA CON HASH
// ==========================================
async function comparePasswords(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  comparePasswords,
  JWT_SECRET
};