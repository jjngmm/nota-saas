// ==========================================
// IMPORTACIONES
// ==========================================
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const authRoutes = require('./routes/auth');
const signupRoutes = require('./routes/signup');
const doctorRoutes = require('./routes/doctors');   
const patientRoutes = require('./routes/patients'); 
const appointmentRoutes = require('./routes/appointments'); 

// ==========================================
// INICIALIZAR EXPRESS
// ==========================================
const app = express();
const PORT = process.env.PORT || 3001;

// ==========================================
// INICIALIZAR SUPABASE
// ==========================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL or SUPABASE_ANON_KEY not set');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✅ Supabase initialized');

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:3000',
    'https://nota-saas.vercel.app',
    'https://*.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());

// Pasar supabase a todas las rutas
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// ==========================================
// ENDPOINTS DE PRUEBA
// ==========================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Nōta Backend is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .limit(1);
    
    if (error) {
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: error.message 
      });
    }
    
    res.json({ 
      status: 'OK',
      message: 'Database connection successful',
      organizations_count: data.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// RUTAS DE NEGOCIO
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/auth', signupRoutes);
app.use('/api', doctorRoutes);
app.use('/api', patientRoutes);
app.use('/api', appointmentRoutes);

// ==========================================
// ERROR HANDLING
// ==========================================
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message 
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================
app.listen(PORT, () => {
  console.log(`✅ Nōta Backend running on http://localhost:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  console.log(`✅ CORS enabled for localhost:5173, localhost:3000, and vercel`);
});
