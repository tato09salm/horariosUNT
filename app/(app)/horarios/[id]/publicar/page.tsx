'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DIAS_LABEL: Record<string, string> = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado' };

export default function PublicarPage() {
  const pathname = usePathname();
  const progId = pathname.split('/')[2];

  const [prog, setProg] = useState<any>(null);
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<any>(null);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [progRes, exportRes] = await Promise.all([
        fetch(`/api/horarios/programaciones/${progId}`).then(r => r.json()),
        fetch(`/api/horarios/exportar?programacion_id=${progId}`).then(r => r.json()).catch(() => ({ asignaciones: [] })),
      ]);
      setProg(progRes.data);
      setAsignaciones(exportRes.asignaciones || progRes.data?.config?.asignaciones || []);
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

  const exportarCSV = async () => {
    const res = await fetch(`/api/horarios/exportar?programacion_id=${progId}&formato=csv`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `horario-${prog?.nombre || progId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportarPDF = () => {
    if (!asignaciones.length) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text(`Horario: ${prog?.nombre || ''}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-PE')}`, 14, 22);

    const rows = asignaciones.map((a: any) => [
      DIAS_LABEL[a.dia] || a.dia,
      a.slot_inicio || '',
      a.curso_codigo,
      a.curso_nombre,
      a.grupo,
      a.tipo,
      a.docente,
      a.aula,
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['Día', 'Hora', 'Código', 'Curso', 'Grupo', 'Tipo', 'Docente', 'Aula']],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235] },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });

    doc.save(`horario-${prog?.nombre || progId}.pdf`);
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando datos...</div>;
  if (!prog) return <div style={{ padding: '40px', textAlign: 'center' }}>Programación no encontrada</div>;

  const publicado = prog.estado === 'publicado';

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '8px' }}>
        <a href="/horarios" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none' }}>← Volver a Horarios</a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>{prog.nombre}</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Fase 4: Revisión y Publicación</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={exportarCSV} disabled={!asignaciones.length}>
            📥 Exportar CSV
          </button>
          <button className="btn-secondary" onClick={exportarPDF} disabled={!asignaciones.length}>
            📄 Exportar PDF
          </button>
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`} style={{ marginBottom: '20px' }}>{msg.text}</div>}

      {/* Panel de publicación */}
      <div className="card" style={{ maxWidth: '700px', margin: '0 auto 32px', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>{publicado ? '🎉' : '📢'}</div>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
          {publicado ? 'Horario Publicado Oficialmente' : 'Listo para publicar'}
        </h2>
        <p style={{ color: '#475569', marginBottom: '24px' }}>
          {publicado
            ? `Publicado el ${new Date(prog.publicado_at).toLocaleDateString('es-PE', { dateStyle: 'long' })}. El horario ya es visible para todos los usuarios.`
            : `El motor ha generado ${asignaciones.length} bloques. Al publicar, este borrador se convierte en el horario oficial del ciclo.`
          }
        </p>
        {!publicado ? (
          <button className="btn-primary" style={{ fontSize: '16px', padding: '12px 32px' }}
            onClick={publicarHorario} disabled={publishing || !asignaciones.length}>
            {publishing ? 'Publicando...' : '🚀 Publicar Horario Oficial'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <a href="/horarios"><button className="btn-secondary">Ver Horarios</button></a>
            <a href="/reportes"><button className="btn-primary">Ir a Reportes</button></a>
          </div>
        )}
      </div>

      {/* Tabla resumen */}
      {asignaciones.length > 0 && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: '0 0 16px' }}>
            Vista Previa — {asignaciones.length} bloques
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                {['Día', 'Curso', 'Nombre', 'Grupo', 'Tipo', 'Docente', 'Aula'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {asignaciones.map((a: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '7px 12px', color: '#334155' }}>{DIAS_LABEL[a.dia] || a.dia}</td>
                  <td style={{ padding: '7px 12px' }}><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{a.curso_codigo}</code></td>
                  <td style={{ padding: '7px 12px', color: '#475569' }}>{a.curso_nombre}</td>
                  <td style={{ padding: '7px 12px', color: '#64748b' }}>{a.grupo}</td>
                  <td style={{ padding: '7px 12px' }}>
                    <span style={{ background: a.tipo === 'teoria' ? '#dbeafe' : a.tipo === 'practica' ? '#d1fae5' : '#fef3c7', color: a.tipo === 'teoria' ? '#1d4ed8' : a.tipo === 'practica' ? '#065f46' : '#92400e', padding: '2px 8px', borderRadius: '999px', fontSize: '11px' }}>
                      {a.tipo}
                    </span>
                  </td>
                  <td style={{ padding: '7px 12px', color: '#475569' }}>{a.docente}</td>
                  <td style={{ padding: '7px 12px' }}><code style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{a.aula}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
