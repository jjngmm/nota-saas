import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="p-8 bg-nota-cream min-h-screen">
      <h1 className="text-4xl font-light font-serif text-nota-ink mb-8">
        Bienvenido, {user?.email}
      </h1>
      
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg border border-nota-light">
          <h3 className="text-sm font-medium text-nota-light mb-2">Citas Hoy</h3>
          <p className="text-3xl font-light text-nota-ink font-serif">0</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-nota-light">
          <h3 className="text-sm font-medium text-nota-light mb-2">Doctores</h3>
          <p className="text-3xl font-light text-nota-ink font-serif">0</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-nota-light">
          <h3 className="text-sm font-medium text-nota-light mb-2">Pacientes</h3>
          <p className="text-3xl font-light text-nota-ink font-serif">0</p>
        </div>
      </div>
    </div>
  );
}