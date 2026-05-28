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
        `/api/horarios/programaciones/${programacionId}/exportar-unt`,
        { cache: 'no-store' }
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
      className="btn-exportar-formato-unt"
    >
      <FileSpreadsheet className="btn-exportar-formato-unt__icon" />
      {cargando ? '⏳ Generando UNT...' : '📋 Exportar Formato Oficial UNT'}
    </button>
  );
}
