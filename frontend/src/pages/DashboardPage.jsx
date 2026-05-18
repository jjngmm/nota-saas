import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/layout/Sidebar";
import Navbar from "../components/layout/Navbar";
import KpiCard from "../components/dashboard/KpiCard";
import AppointmentsToday from "../components/dashboard/AppointmentsToday";
import StatusBreakdown from "../components/dashboard/StatusBreakdown";
import WeeklyChart from "../components/dashboard/WeeklyChart";
import TopDoctors from "../components/dashboard/TopDoctors";
import RecentActivity from "../components/dashboard/RecentActivity";

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      const [apptRes, patientRes, doctorRes] = await Promise.all([
        api.get("/api/appointments"),
        api.get("/api/patients"),
        api.get("/api/doctors"),
      ]);

      const appointments = apptRes.data || [];
      const patients = patientRes.data || [];
      const doctors = doctorRes.data || [];

      setData(buildMetrics({ appointments, patients, doctors }));
    } catch {
      setError("No se pudieron cargar las métricas.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main">
        <Navbar title="Dashboard" />
        <div className="dashboard-loading">
          <div className="dashboard-loading-inner">
            <div className="spinner" />
            <p>Cargando métricas…</p>
          </div>
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main">
        <Navbar title="Dashboard" />
        <div className="dashboard-loading">
          <p className="text-error">{error}</p>
          <button className="action-link" onClick={fetchAll} style={{ marginTop: 8 }}>Reintentar</button>
        </div>
      </div>
    </div>
  );

  const greeting = getGreeting(user?.full_name);

  return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main">
        <Navbar title="Dashboard" />

        <div className="nota-content dashboard-content">

          {/* Greeting */}
          <div className="dash-greeting">
            <div>
              <h1 className="dash-greeting-title">{greeting}</h1>
              <p className="dash-greeting-sub">
                Hoy tienes{" "}
                <strong>{data.todayAppointments.length}</strong>{" "}
                {data.todayAppointments.length === 1 ? "cita programada" : "citas programadas"}
              </p>
            </div>
            <button className="dash-cta" onClick={() => navigate("/appointments")}>
              Ver todas las citas →
            </button>
          </div>

          {/* KPI row */}
          <div className="kpi-grid">
            <KpiCard
              label="Citas este mes"
              value={data.thisMonthCount}
              delta={data.monthDelta}
              deltaLabel="vs mes anterior"
              icon="calendar"
              color="accent"
            />
            <KpiCard
              label="Pacientes activos"
              value={data.totalPatients}
              delta={data.newPatientsThisMonth}
              deltaLabel="nuevos este mes"
              icon="users"
              color="green"
            />
            <KpiCard
              label="Médicos"
              value={data.totalDoctors}
              icon="stethoscope"
              color="blue"
            />
            <KpiCard
              label="Tasa de asistencia"
              value={`${data.attendanceRate}%`}
              delta={null}
              deltaLabel="completadas / programadas"
              icon="check"
              color="teal"
            />
          </div>

          {/* Main grid */}
          <div className="dash-main-grid">

            {/* Left column */}
            <div className="dash-col-main">
              <WeeklyChart weeklyData={data.weeklyData} />
              <AppointmentsToday
                appointments={data.todayAppointments}
                onViewAll={() => navigate("/appointments")}
              />
            </div>

            {/* Right column */}
            <div className="dash-col-side">
              <StatusBreakdown breakdown={data.statusBreakdown} total={data.totalAppointments} />
              <TopDoctors doctors={data.topDoctors} />
              <RecentActivity appointments={data.recentAppointments} />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Data builder ── */
function buildMetrics({ appointments, patients, doctors }) {
  const now = new Date();
  const todayStr = toDateStr(now);

  // Current month / prev month
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const prevYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  const thisMonthAppts = appointments.filter((a) => {
    const d = new Date(a.appointment_date);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  const prevMonthAppts = appointments.filter((a) => {
    const d = new Date(a.appointment_date);
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  });

  const monthDelta = thisMonthAppts.length - prevMonthAppts.length;

  // Today
  const todayAppointments = appointments
    .filter((a) => a.appointment_date === todayStr)
    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  // Patients this month
  const newPatientsThisMonth = patients.filter((p) => {
    if (!p.created_at) return false;
    const d = new Date(p.created_at);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).length;

  // Status breakdown
  const statusCounts = appointments.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  const statusBreakdown = [
    { key: "scheduled", label: "Programadas", color: "#3b82f6" },
    { key: "confirmed", label: "Confirmadas", color: "#6366f1" },
    { key: "completed", label: "Completadas", color: "#22c55e" },
    { key: "cancelled", label: "Canceladas", color: "#ef4444" },
    { key: "no_show", label: "No se presentó", color: "#f59e0b" },
  ].map((s) => ({ ...s, count: statusCounts[s.key] || 0 }));

  // Attendance rate
  const completed = statusCounts["completed"] || 0;
  const scheduled = appointments.filter(
    (a) => a.status !== "cancelled"
  ).length;
  const attendanceRate = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;

  // Weekly data — last 7 days
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    const dateStr = toDateStr(d);
    const count = appointments.filter((a) => a.appointment_date === dateStr).length;
    return {
      label: d.toLocaleDateString("es-MX", { weekday: "short" }),
      date: dateStr,
      count,
      isToday: dateStr === todayStr,
    };
  });

  // Top doctors by appointment count
  const doctorApptMap = appointments.reduce((acc, a) => {
    if (a.doctor_id) {
      acc[a.doctor_id] = (acc[a.doctor_id] || 0) + 1;
    }
    return acc;
  }, {});

  const topDoctors = doctors
    .map((d) => ({ ...d, apptCount: doctorApptMap[d.id] || 0 }))
    .sort((a, b) => b.apptCount - a.apptCount)
    .slice(0, 5);

  // Recent appointments (last 5, any status)
  const recentAppointments = [...appointments]
    .sort((a, b) => {
      const da = new Date(a.appointment_date + "T" + (a.start_time || "00:00"));
      const db = new Date(b.appointment_date + "T" + (b.start_time || "00:00"));
      return db - da;
    })
    .slice(0, 6);

  return {
    totalAppointments: appointments.length,
    thisMonthCount: thisMonthAppts.length,
    monthDelta,
    todayAppointments,
    totalPatients: patients.length,
    newPatientsThisMonth,
    totalDoctors: doctors.length,
    attendanceRate,
    statusBreakdown,
    weeklyData,
    topDoctors,
    recentAppointments,
  };
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function getGreeting(name) {
  const hour = new Date().getHours();
  const firstName = name?.split(" ")[0] || "";
  if (hour < 12) return `Buenos días${firstName ? `, ${firstName}` : ""} 🌤`;
  if (hour < 19) return `Buenas tardes${firstName ? `, ${firstName}` : ""} ☀️`;
  return `Buenas noches${firstName ? `, ${firstName}` : ""} 🌙`;
}