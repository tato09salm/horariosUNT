'use client';

import { useState } from 'react';
import { exportarHorariosExcel } from '@/lib/exportar/excel-horarios';

interface BotonExportarExcelProps {
  programacionId: string;
  variant?: 'primary' | 'secondary' | 'icon';
  label?: string;
}

export function BotonExportarExcel({ 
  programacionId, 
  variant = 'primary',
  label = 'Exportar a Excel'
}: BotonExportarExcelProps) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleExportar = async () => {
    if (cargando) return;
    setCargando(true);
    setError(null);
    
    try {
      // 1. Obtener todos los datos necesarios
      const response = await fetch(
        `/api/horarios/programaciones/${programacionId}/exportar`
      );
      
      if (!response.ok) {
        throw new Error('Error al obtener datos');
      }
      
      const resData = await response.json();
      
      if (resData.error) {
        throw new Error(resData.error);
      }
      
      // 2. Generar el archivo Excel
      await exportarHorariosExcel(resData);
      
    } catch (err: any) {
      setError(err.message || 'Error al generar el Excel');
      console.error(err);
      alert(err.message || 'Error al generar el archivo Excel');
    } finally {
      setCargando(false);
    }
  };
  
  // Variante: Icono solamente
  if (variant === 'icon') {
    return (
      <button
        onClick={handleExportar}
        disabled={cargando}
        className="boton-icon-excel"
        title="Exportar a Excel"
        style={{
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0fdf4',
          color: '#16a34a',
          border: '1px solid #86efac',
          borderRadius: '6px',
          fontSize: '1.1rem',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {cargando ? '⏳' : '📊'}
      </button>
    );
  }
  
  // Variante: Secundario
  if (variant === 'secondary') {
    return (
      <button
        onClick={handleExportar}
        disabled={cargando}
        className="boton-excel-secundario"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          background: 'white',
          color: '#16a34a',
          border: '2px solid #16a34a',
          borderRadius: '6px',
          fontWeight: '500',
          fontSize: '0.9rem',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {cargando ? (
          <>⏳ Generando...</>
        ) : (
          <>📊 {label}</>
        )}
      </button>
    );
  }
  
  // Variante: Primario (default)
  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <button
        onClick={handleExportar}
        disabled={cargando}
        className="boton-excel-principal"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 20px',
          background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontWeight: '600',
          fontSize: '0.95rem',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)',
        }}
      >
        {cargando ? (
          <>
            <span className="spinner" style={{
              display: 'inline-block',
              width: '14px',
              height: '14px',
              border: '2px solid #ffffff80',
              borderTopColor: 'white',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }} />
            <span>Generando archivo...</span>
          </>
        ) : (
          <>
            <span>📊</span>
            <span>{label}</span>
          </>
        )}
        
        {error && (
          <span className="error-tooltip" style={{
            marginLeft: '8px',
            color: '#f87171',
            fontSize: '0.8rem',
          }}>{error}</span>
        )}
      </button>
    </>
  );
}
