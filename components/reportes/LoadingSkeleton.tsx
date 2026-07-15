'use client';

export function SkeletonLine({ width = '100%', height = 14 }: { width?: string; height?: number }) {
  return (
    <div style={{
      width, height,
      background: 'linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)',
      backgroundSize: '200% 100%',
      borderRadius: '4px',
      animation: 'sk-shimmer 1.5s ease-in-out infinite',
    }} />
  );
}

export function SkeletonBlock({ width = '100%', height = 80 }: { width?: string; height?: number }) {
  return (
    <div style={{
      width, height,
      background: 'linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)',
      backgroundSize: '200% 100%',
      borderRadius: '8px',
      animation: 'sk-shimmer 1.5s ease-in-out infinite',
    }} />
  );
}

export function PreviewSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SkeletonLine width="240px" height={20} />
          <SkeletonLine width="180px" height={13} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <SkeletonLine width="80px" height={32} />
          <SkeletonLine width="80px" height={32} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <SkeletonLine width="120px" height={30} />
        <SkeletonLine width="120px" height={30} />
        <SkeletonLine width="160px" height={30} />
      </div>
      <SkeletonBlock height={200} />
    </div>
  );
}

export function TeacherListSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px' }}>
      <SkeletonLine width="100%" height={38} />
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', border: '1px solid #F1F5F9', borderRadius: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <SkeletonLine width="70%" height={14} />
            <SkeletonLine width="40%" height={12} />
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
            <SkeletonLine width="60px" height={12} />
            <SkeletonLine width="40px" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SkeletonLine width="300px" height={22} />
      <SkeletonLine width="200px" height={14} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <SkeletonBlock height={60} />
        <SkeletonBlock height={60} />
        <SkeletonBlock height={60} />
      </div>
      <SkeletonBlock height={300} />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E2E8F0',
      borderRadius: '10px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <SkeletonLine width="60%" height={16} />
      <SkeletonLine width="40%" height={12} />
      <SkeletonLine width="100%" height={12} />
      <SkeletonLine width="80%" height={12} />
    </div>
  );
}

export default function LoadingSkeleton({ type = 'preview' }: { type?: 'preview' | 'teacherList' | 'detail' | 'card' }) {
  switch (type) {
    case 'teacherList': return <TeacherListSkeleton />;
    case 'detail': return <DetailSkeleton />;
    case 'card': return <CardSkeleton />;
    default: return <PreviewSkeleton />;
  }
}

<style>{`
  @keyframes sk-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`}</style>
