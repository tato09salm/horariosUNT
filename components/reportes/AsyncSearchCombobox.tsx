'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

interface Option {
  value: string;
  label: string;
  subtitle?: string;
  detail?: string;
}

interface Props {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => Promise<Option[]>;
  initialOptions?: Option[];
  disabled?: boolean;
  error?: string;
}

export default function AsyncSearchCombobox({
  label,
  placeholder = 'Buscar...',
  value,
  onChange,
  onSearch,
  initialOptions = [],
  disabled = false,
  error,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Option[]>(initialOptions);
  const [loading, setLoading] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController>(undefined);

  const selectedOption = initialOptions.find(o => o.value === value) || options.find(o => o.value === value);

  const doSearch = useCallback(async (q: string) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!q.trim()) {
      setOptions(initialOptions);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const results = await onSearch(q);
      if (!controller.signal.aborted) {
        setOptions(results);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setOptions([]);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [onSearch, initialOptions]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setHighlightedIdx(-1);
    if (!isOpen) setIsOpen(true);
    if (!val.trim()) onChange('');
  };

  const handleSelect = (opt: Option) => {
    onChange(opt.value);
    setQuery('');
    setIsOpen(false);
    setHighlightedIdx(-1);
    setOptions(initialOptions);
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
    setOptions(initialOptions);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIdx(prev => Math.min(prev + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIdx(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIdx >= 0 && options[highlightedIdx]) {
          handleSelect(options[highlightedIdx]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIdx(-1);
        break;
    }
  };

  useEffect(() => {
    if (highlightedIdx >= 0 && listRef.current) {
      const el = listRef.current.children[highlightedIdx] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIdx]);

  return (
    <div className="form-group" style={{ margin: 0, position: 'relative' }}>
      <label style={{
        display: 'block',
        fontSize: '13px',
        fontWeight: 600,
        color: '#172033',
        marginBottom: '6px',
      }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="combobox-list"
          aria-autocomplete="list"
          aria-label={label}
          value={selectedOption && !query ? selectedOption.label : query}
          onChange={handleInputChange}
          onFocus={() => { setIsOpen(true); if (!query.trim()) doSearch(''); }}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={selectedOption ? '' : placeholder}
          disabled={disabled}
          style={{
            width: '100%',
            height: '42px',
            padding: '0 36px 0 12px',
            fontSize: '14px',
            borderRadius: '8px',
            border: error ? '1.5px solid #DC2626' : selectedOption ? '1.5px solid #2563EB' : '1px solid #DCE3EC',
            background: disabled ? '#F1F5F9' : '#fff',
            color: disabled ? '#94A3B8' : '#172033',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
        />
        {selectedOption && !query && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Limpiar selección"
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#94A3B8',
              padding: '4px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
        {loading && !selectedOption && (
          <div style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '16px',
            height: '16px',
            border: '2px solid #E2E8F0',
            borderTopColor: '#2563EB',
            borderRadius: '50%',
            animation: 'as-spin 0.6s linear infinite',
          }} />
        )}
      </div>
      {error && (
        <div style={{ fontSize: '12px', color: '#DC2626', marginTop: '4px' }}>{error}</div>
      )}
      {isOpen && (
        <div
          ref={listRef}
          id="combobox-list"
          role="listbox"
          aria-label={`Resultados para ${label}`}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 100,
            marginTop: '4px',
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            maxHeight: '280px',
            overflowY: 'auto',
          }}
        >
          {loading && options.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
              <div style={{
                width: '16px', height: '16px',
                border: '2px solid #E2E8F0', borderTopColor: '#2563EB',
                borderRadius: '50%',
                animation: 'as-spin 0.6s linear infinite',
                margin: '0 auto 8px',
              }} />
              Buscando...
            </div>
          )}
          {!loading && options.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
              {query ? `No se encontraron resultados para "${query}"` : 'Escribe para buscar'}
            </div>
          )}
          {options.map((opt, idx) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => handleSelect(opt)}
              onMouseEnter={() => setHighlightedIdx(idx)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                background: idx === highlightedIdx ? '#EFF6FF' : opt.value === value ? '#F8FAFC' : 'transparent',
                borderLeft: opt.value === value ? '3px solid #2563EB' : '3px solid transparent',
                transition: 'background 0.1s',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#172033' }}>{opt.label}</div>
              {opt.subtitle && (
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{opt.subtitle}</div>
              )}
              {opt.detail && (
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>{opt.detail}</div>
              )}
            </div>
          ))}
        </div>
      )}
      <style>{`
        @keyframes as-spin { to { transform: translateY(-50%) rotate(360deg); } }
      `}</style>
    </div>
  );
}
