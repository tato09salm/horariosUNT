'use client';

interface Props {
  page: number;
  totalPages: number;
  totalItems?: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export default function Pagination({ page, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange }: Props) {
  if (totalPages <= 1 && totalItems === undefined) return null;

  const getPages = () => {
    const pages: (number | string)[] = [];
    const delta = 2;
    const left = Math.max(2, page - delta);
    const right = Math.min(totalPages - 1, page + delta);

    pages.push(1);
    if (left > 2) pages.push('...');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push('...');
    if (totalPages > 1) pages.push(totalPages);

    return pages;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 0',
      flexWrap: 'wrap',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748B' }}>
        {totalItems !== undefined && (
          <span>{totalItems} resultado{totalItems !== 1 ? 's' : ''}</span>
        )}
        <span style={{ color: '#DCE3EC' }}>|</span>
        <select
          aria-label="Resultados por página"
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          style={{
            padding: '4px 8px',
            borderRadius: '6px',
            border: '1px solid #DCE3EC',
            fontSize: '13px',
            background: '#fff',
            color: '#172033',
            cursor: 'pointer',
          }}
        >
          <option value={12}>12 / pág</option>
          <option value={24}>24 / pág</option>
          <option value={48}>48 / pág</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #DCE3EC',
            background: page <= 1 ? '#F8FAFC' : '#fff',
            color: page <= 1 ? '#CBD5E1' : '#172033',
            cursor: page <= 1 ? 'default' : 'pointer',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          Anterior
        </button>
        {getPages().map((p, i) =>
          typeof p === 'string' ? (
            <span key={`e${i}`} style={{ padding: '6px 4px', color: '#94A3B8', fontSize: '13px' }}>...</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-label={`Página ${p}`}
              aria-current={p === page ? 'page' : undefined}
              style={{
                minWidth: '34px',
                height: '34px',
                borderRadius: '6px',
                border: p === page ? '1px solid #2563EB' : '1px solid #DCE3EC',
                background: p === page ? '#EFF6FF' : '#fff',
                color: p === page ? '#2563EB' : '#172033',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: p === page ? 600 : 400,
              }}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Página siguiente"
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #DCE3EC',
            background: page >= totalPages ? '#F8FAFC' : '#fff',
            color: page >= totalPages ? '#CBD5E1' : '#172033',
            cursor: page >= totalPages ? 'default' : 'pointer',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
