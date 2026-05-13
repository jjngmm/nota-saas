// Importaciones
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const authRoutes = require('./routes/auth');

// Inicializar Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// Inicializar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL or SUPABASE_ANON_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// ENDPOINTS
// ==========================================

app.use('/auth', authRoutes);

// 1. Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Nōta Backend is running',
    timestamp: new Date().toISOString()
  });
});

// 2. Test Supabase Connection
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
// ERROR HANDLING
// ==========================================

app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message 
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(PORT, () => {
  console.log(`✅ Nōta Backend running on http://localhost:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
});