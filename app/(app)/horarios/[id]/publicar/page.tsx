'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import GrillaHorarios from '@/components/horarios/GrillaHorarios';
import { BotonExportarFormatoUNT } from '@/components/exportar/BotonExportarFormatoUNT';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DIAS_LABEL: Record<string, string> = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado' };

export default function PublicarPage() {
  const pathname = usePathname();
  const progId = pathname.split('/')[2];

  const [prog, setProg] = useState<any>(null);
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [showEditarModal, setShowEditarModal] = useState(false);
  const [msg, setMsg] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDocente, setFiltroDocente] = useState('');
  const [filtroCurso, setFiltroCurso] = useState('');
  const itemsPerPage = 20;
  const publicado = prog?.estado === 'publicado';

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [progRes, dashRes, exportRes] = await Promise.all([
        fetch(`/api/horarios/programaciones/${progId}`).then(r => {
          if (!r.ok) throw new Error('Failed to fetch programacion');
          return r.json();
        }),
        fetch('/api/dashboard').then(r => {
          if (!r.ok) throw new Error('Failed to fetch dashboard');
          return r.json();
        }),
        fetch(`/api/horarios/programaciones/${progId}/exportar`).then(r => {
          if (!r.ok) throw new Error('Failed to fetch export');
          return r.json();
        }).catch(() => ({ asignaciones: [] }))
      ]);
      
      setProg(progRes.data);
      const slotsData = dashRes.slots || [];
      setSlots(slotsData);
      
      // Map export asignaciones to match GrillaHorarios format
      const slotByTime = new Map(
        slotsData.map((s: any) => [
          `${(s.hora_inicio || '').substring(0, 5)}-${(s.hora_fin || '').substring(0, 5)}`, 
          s
        ])
      );
      
      const mappedAsignaciones = (exportRes.asignaciones || progRes.data?.config?.asignaciones || []).map((a: any) => {
        const timeKey = `${(a.hora_inicio || '').substring(0, 5)}-${(a.hora_fin || '').substring(0, 5)}`;
        return {
          id: a.id,
          dia: a.dia,
          slot_id: a.slot_id || slotByTime.get(timeKey)?.id || null,
          hora_inicio: a.hora_inicio,
          hora_fin: a.hora_fin,
          curso_nombre: a.curso_nombre,
          curso_codigo: a.curso_codigo,
          ciclo_plan: a.ciclo,
          numero_grupo: parseInt(String(a.grupo || '').replace('G', ''), 10) || 1,
          tipo: a.tipo_sesion || a.tipo,
          docente_id: a.docente_id || null,
          docente_nombre: a.docente_nombre || a.docente || '',
          ambiente_id: null,
          ambiente_nombre: a.aula || '',
          ambiente_codigo: a.aula || '',
          ambiente_tipo: '',
        };
      });
      
      setAsignaciones(mappedAsignaciones);
    } catch (err) {
      console.error('Error loading publicar page:', err);
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

  const retrocederFase = async () => {
    if (!window.confirm('¿Deseas volver a la Fase 3? Se mantendrá el borrador actual.')) return;
    try {
      const res = await fetch(`/api/horarios/programaciones/${progId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase: 3 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.location.href = `/horarios/${progId}/programar`;
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
  };

  const solicitarEditarHorario = () => setShowEditarModal(true);

  const confirmarEditarHorario = async () => {
    setShowEditarModal(false);
    setMsg(null);
    try {
      const res = await fetch(`/api/horarios/programaciones/${progId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase: 3 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo editar el horario');
      window.location.href = `/horarios/${progId}/programar`;
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    }
  };

  const cancelarProgramacion = async () => {
    if (!window.confirm('¿Seguro que deseas cancelar esta programación?')) return;
    try {
      const res = await fetch(`/api/horarios/programaciones/${progId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = '/horarios';
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
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

  const exportarExcel = async () => {
    try {
      const response = await fetch(
        `/api/horarios/programaciones/${progId}/exportar`
      );
      if (!response.ok) {
        throw new Error('Error al obtener datos');
      }
      const resData = await response.json();
      const { exportarHorariosExcel } = await import('@/lib/exportar/excel-horarios');
      await exportarHorariosExcel(resData);
    } catch (err: any) {
      alert(err.message || 'Error al generar el Excel');
      console.error(err);
    }
  };

  const exportarPDF = () => {
    if (!agrupadas.length) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text(`Horario: ${prog?.nombre || ''}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-PE')}`, 14, 22);

    const rows = agrupadas.map((a: any) => [
      DIAS_LABEL[a.dia] || a.dia,
      `${a.hora_inicio?.slice(0,5) || ''} - ${a.hora_fin?.slice(0,5) || ''}`,
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

  const agrupadas = useMemo(() => {
    const dayOrder: Record<string, number> = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
    
    // 0. Filtrar según preferencias del usuario
    const filtered = asignaciones.filter((a: any) => {
      const matchTipo = !filtroTipo || a.tipo === filtroTipo;
      const matchDocente = !filtroDocente || a.docente?.toLowerCase().includes(filtroDocente.toLowerCase());
      const matchCurso = !filtroCurso || 
        a.curso_codigo?.toLowerCase().includes(filtroCurso.toLowerCase()) || 
        a.curso_nombre?.toLowerCase().includes(filtroCurso.toLowerCase());
      return matchTipo && matchDocente && matchCurso;
    });

    // 1. Ordenamos agrupando por identidad de sesión primero para juntar los bloques contiguos
    const sortedForGrouping = [...filtered].sort((a, b) => {
      const dayA = dayOrder[a.dia] || 99;
      const dayB = dayOrder[b.dia] || 99;
      if (dayA !== dayB) return dayA - dayB;
      
      const cursoA = a.curso_codigo || '';
      const cursoB = b.curso_codigo || '';
      if (cursoA !== cursoB) return cursoA.localeCompare(cursoB);
      
      const grpA = a.grupo || '';
      const grpB = b.grupo || '';
      if (grpA !== grpB) return grpA.localeCompare(grpB);
      
      const tipoA = a.tipo || '';
      const tipoB = b.tipo || '';
      if (tipoA !== tipoB) return tipoA.localeCompare(tipoB);
      
      const docA = a.docente || '';
      const docB = b.docente || '';
      if (docA !== docB) return docA.localeCompare(docB);
      
      const aulaA = a.aula || '';
      const aulaB = b.aula || '';
      if (aulaA !== aulaB) return aulaA.localeCompare(aulaB);
      
      const timeA = a.hora_inicio || '';
      const timeB = b.hora_inicio || '';
      return timeA.localeCompare(timeB);
    });

    // 2. Agrupamos los bloques contiguos
    const result: any[] = [];
    for (const a of sortedForGrouping) {
      if (result.length === 0) {
        result.push({ ...a });
        continue;
      }
      const last = result[result.length - 1];
      const sameSession =
        last.dia === a.dia &&
        last.curso_codigo === a.curso_codigo &&
        last.grupo === a.grupo &&
        last.tipo === a.tipo &&
        last.docente === a.docente &&
        last.aula === a.aula;

      if (sameSession && last.hora_fin === a.hora_inicio) {
        last.hora_fin = a.hora_fin;
      } else {
        result.push({ ...a });
      }
    }

    // 3. Finalmente ordenamos cronológicamente el resultado agrupado
    return result.sort((a, b) => {
      const dayA = dayOrder[a.dia] || 99;
      const dayB = dayOrder[b.dia] || 99;
      if (dayA !== dayB) return dayA - dayB;
      
      const timeA = a.hora_inicio || '';
      const timeB = b.hora_inicio || '';
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      
      return (a.curso_codigo || '').localeCompare(b.curso_codigo || '');
    });
  }, [asignaciones, filtroTipo, filtroDocente, filtroCurso]);

  const totalPages = Math.ceil(agrupadas.length / itemsPerPage);
  const paginatedData = agrupadas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando datos...</div>;
  if (!prog) return <div style={{ padding: '40px', textAlign: 'center' }}>Programación no encontrada</div>;

  return (
    <div className="horarios-publicar-page" style={{ padding: '32px' }}>
      <div style={{ marginBottom: '8px' }}>
        <a href="/horarios" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none' }}>← Volver a Horarios</a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>{prog.nombre}</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Fase 4: Revisión y Publicación</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {publicado ? (
            <button className="btn-secondary" onClick={solicitarEditarHorario}>✏️ Editar horario (Volver a Fase 3)</button>
          ) : (
            <>
              <button className="btn-secondary" onClick={retrocederFase}>← Volver a Fase 3</button>
              <button className="btn-danger" onClick={cancelarProgramacion}>Cancelar</button>
            </>
          )}
          {asignaciones.length > 0 && <BotonExportarFormatoUNT programacionId={progId} />}
          <button className="btn-secondary" onClick={exportarCSV} disabled={!asignaciones.length}>
            📥 Exportar CSV
          </button>
          <button className="btn-secondary" onClick={exportarPDF} disabled={!asignaciones.length}>
            📄 Exportar PDF
          </button>
        </div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type}`} style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{msg.text}</span>
          <button
            onClick={() => setMsg(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 8px',
              marginLeft: '16px',
              opacity: 0.7,
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          >
            ×
          </button>
        </div>
      )}

      {/* Panel de publicación */}
      <div className="card horarios-publicar-summary" style={{ maxWidth: '700px', margin: '0 auto 32px', textAlign: 'center' }}>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {publicado ? (
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}>
              <svg width="40" height="40" fill="none" stroke="white" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          ) : (
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}>
              <svg width="40" height="40" fill="none" stroke="white" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          )}
        </div>
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
            {publishing ? 'Publicando...' : 'Publicar Horario Oficial'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <a href="/horarios"><button className="btn-secondary">Volver atrás</button></a>
            <a href="/horarios"><button className="btn-secondary">Ver horario general</button></a>
            <a href="/reportes"><button className="btn-primary">Ir a Reportes</button></a>
          </div>
        )}
      </div>

      {/* Cuadro visual del horario generado */}
      {asignaciones.length > 0 && slots.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Horario generado</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Vista previa del horario oficial</span>
          </div>
          <GrillaHorarios asignaciones={asignaciones} slots={slots} restringidosConfig={prog?.config?.horarios_restringidos} />
        </div>
      )}

      {/* Filtros de Vista Previa */}
      {asignaciones.length > 0 && (
        <div className="card horarios-publicar-filter-card" style={{ marginBottom: '20px', padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: '600' }}>Filtrar por Tipo</label>
              <select className="form-input" value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setCurrentPage(1); }}>
                <option value="">Todos los tipos</option>
                <option value="teoria">Teoría</option>
                <option value="practica">Práctica</option>
                <option value="laboratorio">Laboratorio</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: '600' }}>Filtrar por Docente</label>
              <input type="text" className="form-input" placeholder="Nombre de docente..." value={filtroDocente} onChange={e => { setFiltroDocente(e.target.value); setCurrentPage(1); }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: '600' }}>Filtrar por Curso</label>
              <input type="text" className="form-input" placeholder="Código o nombre de curso..." value={filtroCurso} onChange={e => { setFiltroCurso(e.target.value); setCurrentPage(1); }} />
            </div>
          </div>
        </div>
      )}

      {showEditarModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowEditarModal(false)}>
          <div className="modal" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>¿Editar horario publicado?</h2>
              <button onClick={() => setShowEditarModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning">
                Esto despublicará el horario oficial del ciclo y volverá la programación a la Fase 3 para que puedas editarla.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowEditarModal(false)}>Cancelar</button>
              <button className="btn-danger" onClick={confirmarEditarHorario}>Sí, despublicar y editar</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla resumen agrupada */}
      {agrupadas.length > 0 ? (
        <div className="card horarios-publicar-table-card" style={{ overflowX: 'auto', padding: 0 }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
              Vista Previa — {agrupadas.length} bloques asignados ({asignaciones.length} horas)
            </h3>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Página {currentPage} de {totalPages}</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn-secondary" style={{ padding: '6px 10px' }} onClick={() => setCurrentPage(c => Math.max(1, c - 1))} disabled={currentPage === 1}>Anterior</button>
                  <button className="btn-secondary" style={{ padding: '6px 10px' }} onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))} disabled={currentPage === totalPages}>Siguiente</button>
                </div>
              </div>
            )}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Día', 'Hora', 'Curso', 'Nombre', 'Grupo', 'Tipo', 'Docente', 'Aula'].map(h => (
                  <th key={h} style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((a: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '500' }}>{DIAS_LABEL[a.dia] || a.dia}</td>
                  <td style={{ padding: '10px 12px', color: '#0f172a', fontWeight: '600' }}>{a.hora_inicio?.slice(0,5) || ''} - {a.hora_fin?.slice(0,5) || ''}</td>
                  <td style={{ padding: '10px 12px' }}><code className="horarios-publicar-code" style={{ background: '#e2e8f0', color: '#1e293b', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{a.curso_codigo}</code></td>
                  <td style={{ padding: '10px 12px', color: '#475569', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.curso_nombre}>{a.curso_nombre}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{a.grupo}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className={`horarios-publicar-type horarios-publicar-type--${a.tipo}`} style={{ background: a.tipo === 'teoria' ? '#e2e8f0' : a.tipo === 'practica' ? '#dcfce7' : '#f3f4f6', color: a.tipo === 'teoria' ? '#334155' : a.tipo === 'practica' ? '#14532d' : '#4b5563', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                      {a.tipo}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#475569' }}>{a.docente}</td>
                  <td style={{ padding: '10px 12px' }}><code className="horarios-publicar-code horarios-publicar-code--room" style={{ background: '#e2e8f0', color: '#1e293b', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{a.aula}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
          No se encontraron asignaciones con los filtros seleccionados.
        </div>
      )}
    </div>
  );
}
