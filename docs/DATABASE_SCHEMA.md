# Esquema de Base de Datos Nōta SaaS

## Tablas

### organizations
- `id` (UUID): Identificador único
- `name` (VARCHAR): Nombre de la clínica
- `email` (VARCHAR): Email contacto
- `stripe_customer_id` (VARCHAR): Para pagos
- `status` (VARCHAR): active/cancelled

### users
- `id` (UUID): Identificador único
- `org_id` (UUID): Clínica a la que pertenece
- `email` (VARCHAR): Email del usuario
- `role` (VARCHAR): admin/secretary/viewer

### doctors
- `id` (UUID): Identificador único
- `org_id` (UUID): Clínica
- `name` (VARCHAR): Nombre del médico
- `specialty` (VARCHAR): Especialidad
- `google_calendar_id` (VARCHAR): Para sincronizar

### doctor_availability
- `id` (UUID): Identificador único
- `doctor_id` (UUID): Médico
- `day_of_week` (INT): 0-6
- `start_time` (TIME): Hora inicio
- `end_time` (TIME): Hora fin
- `duration_minutes` (INT): Duración cita

### appointments
- `id` (UUID): Identificador único
- `org_id` (UUID): Clínica
- `doctor_id` (UUID): Médico
- `patient_name` (VARCHAR): Nombre paciente
- `scheduled_at` (TIMESTAMP): Fecha/hora cita
- `status` (VARCHAR): scheduled/completed/cancelled
- `google_event_id` (VARCHAR): Para sincronizar

### billing_events
- `id` (UUID): Identificador único
- `org_id` (UUID): Clínica
- `stripe_event_id` (VARCHAR): Del pago
- `amount_cents` (INT): Monto
- `event_type` (VARCHAR): invoice.paid, etc

## Seguridad

- RLS habilitado en todas las tablas
- Usuarios solo ven datos de su org_id
- Políticas de acceso basadas en org_id