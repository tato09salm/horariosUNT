'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@unt.edu.pe');
  const [password, setPassword] = useState('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)'}}>
      <div style={{width:'100%',maxWidth:'420px',padding:'0 16px'}}>
        <div style={{textAlign:'center',marginBottom:'32px'}}>
          <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'64px',height:'64px',borderRadius:'16px',background:'rgba(255,255,255,0.1)',marginBottom:'16px'}}>
            <svg width="36" height="36" fill="none" stroke="white" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <h1 style={{fontSize:'24px',fontWeight:'700',color:'white',margin:'0 0 4px'}}>SiHorarios UNT</h1>
          <p style={{fontSize:'13px',color:'rgba(147,197,253,0.9)',margin:'0 0 2px'}}>Escuela de Ingeniería de Sistemas</p>
          <p style={{fontSize:'12px',color:'rgba(147,197,253,0.7)',margin:0}}>Universidad Nacional de Trujillo</p>
        </div>

        <div style={{background:'white',borderRadius:'20px',padding:'32px',boxShadow:'0 25px 50px rgba(0,0,0,0.3)'}}>
          <h2 style={{fontSize:'18px',fontWeight:'600',color:'#1e293b',marginTop:0,marginBottom:'24px'}}>Iniciar sesión</h2>

          {error && (
            <div className="alert alert-error">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" style={{flexShrink:0}}>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Correo electrónico</label>
              <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary" style={{width:'100%',justifyContent:'center',padding:'12px',marginTop:'8px',fontSize:'15px'}} disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar al sistema'}
            </button>
          </form>

          <div style={{marginTop:'20px',paddingTop:'16px',borderTop:'1px solid #f1f5f9'}}>
            <p style={{fontSize:'11px',color:'#94a3b8',textAlign:'center',margin:'0 0 8px'}}>Credenciales de prueba</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',fontSize:'11px',color:'#64748b'}}>
              <div style={{background:'#f8fafc',borderRadius:'8px',padding:'8px'}}>
                <p style={{fontWeight:'600',color:'#374151',margin:'0 0 2px'}}>Admin</p>
                <p style={{margin:'0 0 1px'}}>admin@unt.edu.pe</p>
                <p style={{margin:0}}>password</p>
              </div>
              <div style={{background:'#f8fafc',borderRadius:'8px',padding:'8px'}}>
                <p style={{fontWeight:'600',color:'#374151',margin:'0 0 2px'}}>Secretaria</p>
                <p style={{margin:'0 0 1px'}}>secretaria@unt.edu.pe</p>
                <p style={{margin:0}}>password</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
