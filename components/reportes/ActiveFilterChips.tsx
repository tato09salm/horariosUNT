'use client';

interface Filter {
  label: string;
  value: string;
  onRemove: () => void;
}

interface Props {
  filters: Filter[];
}

export default function ActiveFilterChips({ filters }: Props) {
  const active = filters.filter(f => f.value);
  if (active.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      alignItems: 'center',
      padding: '8px 0',
    }}>
      <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Filtros activos:</span>
      {active.map((f, i) => (
        <div
          key={i}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#1D4ED8',
            fontWeight: 500,
          }}
        >
          <span style={{ fontWeight: 400, color: '#64748B' }}>{f.label}:</span>
          {f.value}
          <button
            type="button"
            onClick={f.onRemove}
            aria-label={`Quitar filtro ${f.label}`}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#1D4ED8',
              fontSize: '14px',
              padding: 0,
              lineHeight: 1,
              opacity: 0.6,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
