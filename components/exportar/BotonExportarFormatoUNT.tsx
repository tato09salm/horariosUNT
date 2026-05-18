'use client';

import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';

export function BotonExportarFormatoUNT({ 
  programacionId 
}: { 
  programacionId: string 
}) {
  const [cargando, setCargando] = useState(false);
  
  const handleExportar = async () => {
    setCargando(true);
    try {
      const response = await fetch(
        `/api/horarios/programaciones/${programacionId}/exportar-unt`
      );
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error al obtener datos');
      }
      
      const datos = await response.json();
      
      const { exportarHorariosFormatoUNT } = await import(
        '@/lib/exportar/excel-horarios-unt'
      );
      
      await exportarHorariosFormatoUNT(datos);
      
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'desconocido'}`);
      console.error(err);
    } finally {
      setCargando(false);
    }
  };
  
  return (
    <button
      onClick={handleExportar}
      disabled={cargando}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
    >
      <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
      {cargando ? '⏳ Generando UNT...' : '📋 Exportar Formato Oficial UNT'}
    </button>
  );
}
