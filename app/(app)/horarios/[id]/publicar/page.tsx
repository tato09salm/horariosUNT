'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

export default function PublicarPage() {
  const pathname = usePathname();
  const progId = pathname.split('/')[2];

  const [prog, setProg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<any>(null);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/horarios/programaciones/${progId}`);
      const data = await res.json();
      setProg(data.data);
    } finally {
      setLoading(false);
    }
  }, [progId]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const publicarHorario = async () => {
    if (!window.confirm('¿Estás seguro de publicar este horario? Esto sobreescribirá el horario oficial del ciclo.')) return;
    
    setPublishing(true); setMsg(null);
    try {
      const res = await fetch('/api/horarios/publicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programacion_id: progId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setMsg({ type: 'success', text: `¡Horario publicado con éxito! Se insertaron ${data.count} bloques.` });
      cargarDatos();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setPublishing(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando datos...</div>;
  if (!prog) return <div style={{ padding: '40px', textAlign: 'center' }}>Programación no encontrada</div>;

  const totalAsignaciones = prog.config?.asignaciones?.length || 0;

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '8px' }}>
        <a href="/horarios" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none' }}>← Volver a Horarios</a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>{prog.nombre}</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Fase 4: Publicación y Consolidación</p>
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>
          {prog.estado === 'publicado' ? '🎉' : '📢'}
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
          {prog.estado === 'publicado' ? 'Horario Oficialmente Publicado' : 'Listo para publicar'}
        </h2>
        
        {prog.estado === 'publicado' ? (
          <p style={{ color: '#475569', marginBottom: '24px' }}>
            Este horario ha sido inyectado en la base de datos principal y ya es visible para todos los docentes y secretarias en el Dashboard general.
          </p>
        ) : (
          <p style={{ color: '#475569', marginBottom: '24px' }}>
            El motor CSP ha generado <strong>{totalAsignaciones} bloques</strong> de horario de forma tentativa. 
            Al hacer clic en publicar, este borrador se convertirá en el horario oficial del ciclo <strong>{prog.ciclo_nombre}</strong>.
          </p>
        )}

        {prog.estado !== 'publicado' ? (
          <button 
            className="btn-primary" 
            style={{ fontSize: '16px', padding: '12px 32px' }} 
            onClick={publicarHorario}
            disabled={publishing}
          >
            {publishing ? 'Inyectando a Base de Datos...' : '🚀 Publicar Horario Oficial'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <a href="/horarios" style={{ textDecoration: 'none' }}>
              <button className="btn-secondary">Volver al inicio</button>
            </a>
            <a href="/reportes" style={{ textDecoration: 'none' }}>
              <button className="btn-primary">Descargar Reportes PDF</button>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
