const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const authRoutes = require('./routes/auth');
const signupRoutes = require('./routes/signup');
const doctorRoutes = require('./routes/doctors');
const patientRoutes = require('./routes/patients');
const appointmentRoutes = require('./routes/appointments');
const valeriaRoutes = require('./routes/valeria');
const clinicalNotesRoutes = require('./routes/clinical_notes');
const doctorRegisterRoutes = require('./routes/doctor_register');
const doctorConfigRoutes = require('./routes/doctor_config');
const ayudaRoutes = require('./routes/ayuda');
const planesRoutes = require('./routes/planes');
const estadisticasRoutes = require('./routes/estadisticas');
const formsRoutes = require('./routes/forms');
const agendaRoutes = require('./routes/agenda');
const remindersRoutes = require('./routes/reminders');
const scribeRoutes = require('./routes/scribe');
const patientRecordsRoutes = require('./routes/patient_records');

const app = express();
const PORT = process.env.PORT || 3001;

const supabaseUrl = process.env.SUPABASE_URL;
// Preferir service_role key (bypasea RLS, solo debe usarse en el backend).
// Fallback a anon key mientras no este configurada.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_ANON_KEY) son requeridos');
  process.exit(1);
}
const usingServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
console.log('Supabase initialized - ' + (usingServiceRole ? 'service_role key' : 'anon key (agrega SUPABASE_SERVICE_ROLE_KEY al .env)'));

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://nota-saas.vercel.app',
    'https://*.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Nota Backend is running',
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

app.use('/api/auth', authRoutes);
app.use('/api/auth', signupRoutes);
app.use('/api/auth', doctorRegisterRoutes);
app.use('/api', doctorRoutes);
app.use('/api', patientRoutes);
app.use('/api', appointmentRoutes);
app.use('/api/valeria', valeriaRoutes);
app.use('/api', clinicalNotesRoutes);
app.use('/api/scribe', scribeRoutes);
app.use('/api/config', doctorConfigRoutes);
app.use('/api/ayuda', ayudaRoutes);
app.use('/api/planes', planesRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/forms', formsRoutes);
app.use('/api/agenda', agendaRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api', patientRecordsRoutes);


app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log('Nota Backend running on http://localhost:' + PORT);
  console.log('Health check: http://localhost:' + PORT + '/health');
  console.log('CORS enabled for vercel and localhost');
});
