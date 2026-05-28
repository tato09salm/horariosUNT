'use client';

import { useMemo } from 'react';
import { type ColorCurso } from '@/lib/colores-curso';

function romanizar(num: number): string {
  const romanos = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return romanos[num] || num.toString();
}

interface CursoLeyenda {
  codigo: string;
  nombre: string;
  ciclo: number;
  color: ColorCurso;
}

export default function LeyendaHorarios({ 
  mapaColores,
  asignaciones
}: { 
  mapaColores?: Map<string, ColorCurso>;
  asignaciones: any[];
}) {
  const cursosPorCiclo = useMemo(() => {
    if (!mapaColores || !asignaciones) return {};
    
    // Group unique courses by cycle
    const groups: Record<number, Map<string, CursoLeyenda>> = {};
    
    asignaciones.forEach(a => {
      const ciclo = a.ciclo_plan || a.ciclo || 0;
      if (!ciclo) return;
      if (a.tipo === 'asesoria') return; // Asesorías don't have course colors in the course list legend
      
      const codigo = a.curso_codigo;
      if (!codigo) return;
      
      if (!groups[ciclo]) {
        groups[ciclo] = new Map();
      }
      
      if (!groups[ciclo].has(codigo)) {
        const key = `${ciclo}-${codigo}`;
        const color = mapaColores.get(key) || { bg: '#FECACA', border: '#DC2626', name: 'rojo' };
        groups[ciclo].set(codigo, {
          codigo,
          nombre: a.curso_nombre || codigo,
          ciclo,
          color
        });
      }
    });

    // Convert Map values to sorted array
    const sortedGroups: Record<number, CursoLeyenda[]> = {};
    Object.entries(groups).forEach(([cicloStr, map]) => {
      const ciclo = parseInt(cicloStr);
      sortedGroups[ciclo] = Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    });

    return sortedGroups;
  }, [mapaColores, asignaciones]);

  return (
    <div className="leyenda-horarios card" style={{ padding: '20px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
      <h4 className="leyenda-horarios__titulo" style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 16px', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px' }}>Leyenda y Guía de Horario</h4>
      
      <div className="leyenda-horarios__grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        <section>
          <p className="leyenda-horarios__seccion" style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 8px' }}>Tipo de Sesión</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#1e40af', color: 'white', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', width: '20px', textAlign: 'center' }}>T</span> 
              <span>Teoría (📘)</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#b45309', color: 'white', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', width: '20px', textAlign: 'center' }}>P</span> 
              <span>Práctica (✏️)</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#166534', color: 'white', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', width: '20px', textAlign: 'center' }}>L</span> 
              <span>Laboratorio (🔬)</span>
            </li>
            {/*
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#7c2d12', color: 'white', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', width: '20px', textAlign: 'center' }}>C</span>
              <span>Consejería / Asesoría (💬)</span>
            </li>
            */}
          </ul>
        </section>
        
        <section>
          <p className="leyenda-horarios__seccion" style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 8px' }}>Prioridad Asignada</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>★ P1</span>
              <span>Docente Nombrado</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>○ P2</span>
              <span>Docente Contratado</span>
            </li>
          </ul>
        </section>

        <section>
          <p className="leyenda-horarios__seccion" style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 8px' }}>Código de Asesorías</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span 
                style={{
                  background: '#E5E7EB',
                  borderLeft: '4px solid #6B7280',
                  width: '24px',
                  height: '16px',
                  display: 'inline-block',
                  borderRadius: '2px'
                }}
              />
              <span>Bloque de Asesoría (Neutro)</span>
            </li>
          </ul>
        </section>
      </div>

      {Object.keys(cursosPorCiclo).length > 0 && (
        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <p className="leyenda-horarios__seccion" style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 12px' }}>Código de Colores de Curso por Ciclo</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.entries(cursosPorCiclo).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).map(([ciclo, items]) => (
              <div key={ciclo} style={{ background: 'var(--bg-card-hover)', borderRadius: '8px', padding: '16px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontWeight: '700', color: 'var(--text-primary)', fontSize: '13px' }}>
                  Cursos del Ciclo {romanizar(parseInt(ciclo))}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {items.map((curso) => (
                    <div key={curso.codigo} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span 
                        className="color-indicador"
                        style={{
                          background: curso.color.bg,
                          borderLeft: `4px solid ${curso.color.border}`,
                          width: '32px',
                          height: '20px',
                          borderRadius: '4px',
                          flexShrink: 0,
                          backgroundImage: curso.color.patron === 'rayado' ? 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 6px)' : undefined
                        }}
                      />
                      <div className="info-curso" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                        <span className="nombre-completo" style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={curso.nombre}>
                          {curso.nombre}
                        </span>
                        <span className="codigo-pequeno" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          ({curso.codigo})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
