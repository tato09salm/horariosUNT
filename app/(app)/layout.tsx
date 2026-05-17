'use client';
import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

interface User { id: string; nombre: string; apellidos: string; email: string; rol: string; }
const UserContext = createContext<User | null>(null);
export const useUser = () => useContext(UserContext);

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', roles: ['admin','secretaria','docente'] },
  { href: '/horarios', label: 'Horarios', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', roles: ['admin','secretaria','docente'] },
  { href: '/docentes', label: 'Docentes', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', roles: ['admin','secretaria'] },
  { href: '/cursos', label: 'Cursos', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', roles: ['admin','secretaria'] },
  { href: '/aulas', label: 'Aulas y Labs', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', roles: ['admin','secretaria'] },
  { href: '/reportes', label: 'Reportes', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', roles: ['admin','secretaria'] },
  { href: '/usuarios', label: 'Usuarios', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', roles: ['admin'] },
  { href: '/auditoria', label: 'Auditoría', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', roles: ['admin'] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.user) setUser(d.user); else router.push('/'); })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, []);

  // Cerrar sidebar al cambiar de ruta en mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f1f5f9'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:'40px',height:'40px',border:'3px solid #e2e8f0',borderTop:'3px solid #1a3a5c',borderRadius:'50%',animation:'spin 0.7s linear infinite',margin:'0 auto 12px'}} />
        <p style={{color:'#64748b',fontSize:'14px'}}>Cargando...</p>
      </div>
    </div>
  );

  const visibleNav = navItems.filter(n => !user || n.roles.includes(user.rol));

  return (
    <UserContext.Provider value={user}>
      <div>
        {/* Mobile Header */}
        <header className="mobile-header">
          <button 
            onClick={() => setSidebarOpen(true)}
            style={{background:'none',border:'none',color:'#475569',padding:'8px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div style={{marginLeft:'12px',fontWeight:'700',fontSize:'16px',color:'#1e293b'}}>SiHorarios UNT</div>
        </header>

        {/* Overlay para mobile */}
        <div 
          className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          {/* Header del Sidebar */}
          <div style={{padding:'24px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
              <div style={{width:'32px',height:'32px',borderRadius:'8px',background:'#3b82f6',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="18" height="18" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <span style={{color:'white',fontWeight:'700',fontSize:'16px',letterSpacing:'-0.025em'}}>SiHorarios</span>
            </div>
            {/* Botón cerrar solo visible en mobile */}
            <button 
              className="show-sm"
              onClick={() => setSidebarOpen(false)}
              style={{background:'rgba(255,255,255,0.1)',border:'none',color:'#94a3b8',padding:'6px',borderRadius:'6px',cursor:'pointer'}}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Nav con Scroll */}
          <div className="sidebar-scroll">
            <nav>
              {visibleNav.map(item => (
                <Link key={item.href} href={item.href} className={`nav-item${pathname.startsWith(item.href) ? ' active' : ''}`}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{flexShrink:0}}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>

          {/* User info Compacto */}
          <div className="user-footer">
            <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'12px'}}>
              <div style={{width:'38px',height:'36px',borderRadius:'8px',background:'#1e293b',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:'1px solid rgba(255,255,255,0.1)'}}>
                <span style={{color:'white',fontSize:'13px',fontWeight:'700'}}>{user?.nombre?.[0]}{user?.apellidos?.[0]}</span>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{color:'white',fontSize:'13px',fontWeight:'600',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {user?.nombre} {user?.apellidos}
                </p>
                <p style={{color:'#94a3b8',fontSize:'11px',margin:0,textTransform:'lowercase',fontWeight:'500'}}>
                  {user?.rol}
                </p>
              </div>
            </div>
            <button 
              onClick={logout} 
              style={{
                width:'100%',
                background:'transparent',
                border:'1px solid rgba(255,255,255,0.1)',
                color:'#f1f5f9',
                borderRadius:'8px',
                padding:'8px',
                fontSize:'12.5px',
                cursor:'pointer',
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                gap:'8px',
                transition:'all 0.2s',
                fontWeight:'500'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="main-content">
          {children}
        </main>
      </div>
    </UserContext.Provider>
  );
}
