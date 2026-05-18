'use client';

import { useState, useMemo, useEffect } from 'react';

export interface Docente {
  id: string;
  nombre: string;
  apellidos: string;
  dni?: string;
  categoria?: string;
  condicion?: string;
  horas_max_semana?: number;
  horas_asignadas?: number;
}

interface SelectorDocenteProps {
  docentes: Docente[];
  docenteSeleccionadoId: string;
  onSeleccionar: (docenteId: string) => void;
}

export function SelectorDocente({ 
  docentes, 
  docenteSeleccionadoId, 
  onSeleccionar 
}: SelectorDocenteProps) {
  const selectedDocente = useMemo(() => {
    return docentes.find(d => d.id === docenteSeleccionadoId) || null;
  }, [docentes, docenteSeleccionadoId]);

  const [busqueda, setBusqueda] = useState('');
  const [mostrarLista, setMostrarLista] = useState(false);

  // Sync busqueda with selectedDocente if changed externally
  useEffect(() => {
    if (selectedDocente) {
      setBusqueda(`${selectedDocente.apellidos || ''}, ${selectedDocente.nombre}`.trim());
    } else {
      setBusqueda('');
    }
  }, [selectedDocente]);
  
  const docentesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return docentes.slice(0, 10);
    
    // If the input matches exactly the selected teacher, show the top 10
    if (selectedDocente && busqueda === `${selectedDocente.apellidos || ''}, ${selectedDocente.nombre}`.trim()) {
      return docentes.slice(0, 10);
    }
    
    const query = busqueda.toLowerCase();
    return docentes
      .filter(d => {
        const fullName = `${d.nombre} ${d.apellidos || ''}`.toLowerCase();
        const reversedName = `${d.apellidos || ''} ${d.nombre}`.toLowerCase();
        return (
          fullName.includes(query) ||
          reversedName.includes(query) ||
          d.dni?.includes(query)
        );
      })
      .slice(0, 20); // Limit to 20 results
  }, [docentes, busqueda, selectedDocente]);
  
  const handleSeleccionar = (docente: Docente) => {
    onSeleccionar(docente.id);
    setBusqueda(`${docente.apellidos || ''}, ${docente.nombre}`.trim());
    setMostrarLista(false);
  };
  
  const handleLimpiar = () => {
    onSeleccionar('');
    setBusqueda('');
    setMostrarLista(false);
  };

  const displayCategory = (cat?: string) => {
    if (!cat) return '';
    return cat.replace('_', ' ').toUpperCase();
  };
  
  return (
    <div className="selector-docente" style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
      <label className="selector-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
        Filtrar por Docente (Autocompletado):
      </label>
      
      <div className="input-wrapper" style={{ position: 'relative' }}>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setMostrarLista(true);
          }}
          onFocus={() => setMostrarLista(true)}
          onBlur={() => {
            // Delay to allow list item clicks to register
            setTimeout(() => setMostrarLista(false), 200);
          }}
          placeholder="Escribe el nombre o DNI del docente..."
          className="form-input"
          style={{
            width: '100%',
            padding: '10px 36px 10px 12px',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            fontSize: '13px',
            background: '#ffffff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            outline: 'none',
            transition: 'all 0.2s'
          }}
        />
        
        {docenteSeleccionadoId && (
          <button 
            onClick={handleLimpiar}
            className="boton-limpiar"
            type="button"
            style={{
              position: 'absolute',
              right: '32px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              fontSize: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}
            title="Limpiar filtro"
          >
            ✕
          </button>
        )}
        
        <span className="icono-busqueda" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '13px', pointerEvents: 'none' }}>
          🔍
        </span>
      </div>
      
      {mostrarLista && docentesFiltrados.length > 0 && (
        <ul className="lista-sugerencias card" style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'white',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          marginTop: '4px',
          maxHeight: '260px',
          overflowY: 'auto',
          zIndex: 9999,
          listStyle: 'none',
          padding: '4px 0',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
        }}>
          {docentesFiltrados.map(docente => (
            <li
              key={docente.id}
              className="sugerencia-item"
              onMouseDown={() => handleSeleccionar(docente)} // Use onMouseDown to trigger before onBlur input hides it
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #f1f5f9',
                transition: 'background 0.15s'
              }}
            >
              <div className="docente-info" style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1, marginRight: '8px' }}>
                <span className="docente-nombre" style={{ fontSize: '13px', color: '#1e293b', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {docente.apellidos}, {docente.nombre}
                </span>
                <span className="docente-categoria" style={{ fontSize: '11px', color: '#64748b', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayCategory(docente.categoria)} - {docente.condicion || ''}
                </span>
              </div>
              <span className="docente-carga" style={{
                fontSize: '11px',
                color: '#1e3a8a',
                background: '#eff6ff',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: '600',
                border: '1px solid #dbeafe',
                flexShrink: 0
              }}>
                {docente.horas_asignadas || 0}h / {docente.horas_max_semana || 20}h
              </span>
            </li>
          ))}
        </ul>
      )}
      
      {mostrarLista && busqueda && docentesFiltrados.length === 0 && (
        <div className="sin-resultados card" style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'white',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          marginTop: '4px',
          padding: '12px',
          color: '#64748b',
          fontStyle: 'italic',
          textAlign: 'center',
          fontSize: '12px',
          zIndex: 9999,
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
        }}>
          No se encontraron docentes con &quot;{busqueda}&quot;
        </div>
      )}
    </div>
  );
}
