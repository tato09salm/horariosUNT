'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface OpcionCombobox {
  id: string;
  nombre: string;
  grupo?: boolean;
}

interface ComboboxOpcionesProps {
  value: string;
  onChange: (id: string) => void;
  opciones: OpcionCombobox[];
  ariaLabel: string;
  placeholder?: string;
  searchPlaceholder?: string;
  badgeGrupo?: string;
  disabled?: boolean;
}

export function ComboboxOpciones({
  value,
  onChange,
  opciones,
  ariaLabel,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  badgeGrupo = 'TODOS',
  disabled = false,
}: ComboboxOpcionesProps) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resaltado, setResaltado] = useState(0);
  const [scrollState, setScrollState] = useState<{ top: boolean; bottom: boolean }>({ top: false, bottom: false });
  const contRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const opcionesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return opciones;
    return opciones.filter(o => !o.grupo && o.nombre.toLowerCase().includes(q));
  }, [opciones, busqueda]);

  const etiquetaActual = useMemo(() => {
    const opt = opciones.find(o => o.id === value);
    return opt ? opt.nombre : (opciones.length ? opciones[0].nombre : '');
  }, [opciones, value]);

  const elegir = useCallback((id: string) => {
    onChange(id);
    setAbierto(false);
  }, [onChange]);

  const toggle = useCallback(() => {
    setAbierto(prev => {
      const next = !prev;
      if (next) {
        setBusqueda('');
        setResaltado(0);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      return next;
    });
  }, []);

  const actualizarScroll = useCallback(() => {
    const el = listaRef.current;
    if (!el) return;
    setScrollState({
      top: el.scrollTop > 4,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 4,
    });
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setResaltado(h => (opcionesFiltradas.length ? (h + 1) % opcionesFiltradas.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setResaltado(h => (opcionesFiltradas.length ? (h - 1 + opcionesFiltradas.length) % opcionesFiltradas.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = opcionesFiltradas[resaltado];
      if (opt) elegir(opt.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setAbierto(false);
      inputRef.current?.blur();
    }
  }, [opcionesFiltradas, resaltado, elegir]);

  useEffect(() => { setResaltado(0); }, [busqueda]);

  useEffect(() => {
    if (abierto) setTimeout(actualizarScroll, 0);
  }, [abierto, actualizarScroll]);

  useEffect(() => {
    if (!abierto) return;
    const el = listaRef.current?.querySelector(`[data-idx="${resaltado}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [resaltado, abierto]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (contRef.current && !contRef.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  return (
    <div ref={contRef} style={{ position: 'relative' }}>
      <button
        type="button"
        role="combobox"
        aria-expanded={abierto}
        aria-haspopup="listbox"
        aria-controls="combobox-listbox"
        aria-label={ariaLabel}
        onClick={toggle}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '10px',
          border: `1px solid ${abierto ? '#2563EB' : 'var(--input-border)'}`,
          boxShadow: abierto ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
          background: disabled ? 'var(--bg-card)' : 'var(--input-bg)',
          color: 'var(--text-primary)',
          fontSize: '14px',
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          opacity: disabled ? 0.55 : 1,
          transition: 'all 0.15s ease',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: value ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          {value ? etiquetaActual : placeholder}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--text-secondary)' }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {abierto && (
        <div
          id="combobox-listbox"
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '10px', borderBottom: '1px solid var(--border-color)' }}>
            <input
              ref={inputRef}
              type="text"
              role="searchbox"
              aria-label={`${ariaLabel} - búsqueda`}
              placeholder={searchPlaceholder}
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              onKeyDown={onKeyDown}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '13px',
                borderRadius: '8px',
                border: '1px solid var(--input-border)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'all 0.15s ease',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--input-border)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          <div
            ref={listaRef}
            onScroll={actualizarScroll}
            style={{ maxHeight: '220px', overflowY: 'auto', position: 'relative' }}
          >
            {scrollState.top && (
              <div style={{ position: 'sticky', top: 0, height: '14px', background: 'linear-gradient(to bottom, rgba(2,6,23,0.10), rgba(2,6,23,0))', pointerEvents: 'none', zIndex: 1, marginBottom: '-14px' }} />
            )}
            {opcionesFiltradas.length === 0 ? (
              <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Sin resultados para &quot;{busqueda}&quot;
              </div>
            ) : (
              opcionesFiltradas.map((opt, idx) => {
                const seleccionada = value === opt.id;
                const resaltada = idx === resaltado;
                return (
                  <div key={opt.id}>
                    {idx === 1 && !busqueda && (
                      <div role="separator" style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                    )}
                    <div
                      role="option"
                      data-idx={idx}
                      aria-selected={seleccionada}
                      onClick={() => elegir(opt.id)}
                      onMouseEnter={() => setResaltado(idx)}
                      style={{
                        padding: '9px 12px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: seleccionada ? 'rgba(59,130,246,0.12)' : resaltada ? 'var(--bg-card-hover)' : 'transparent',
                        fontWeight: seleccionada ? '600' : '400',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span style={{ width: '18px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                        {seleccionada ? '✓' : (resaltada ? '▸' : '')}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.nombre}</span>
                      {opt.grupo && (
                        <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', background: 'var(--bg-card-hover)', padding: '2px 8px', borderRadius: '10px' }}>{badgeGrupo}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {scrollState.bottom && (
              <div style={{ position: 'sticky', bottom: 0, height: '14px', background: 'linear-gradient(to top, rgba(2,6,23,0.10), rgba(2,6,23,0))', pointerEvents: 'none', zIndex: 1, marginTop: '-14px' }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
