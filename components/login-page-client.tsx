'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTheme } from '@/lib/theme';
import { motion } from 'framer-motion';

export default function LoginPageClient() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useTheme();
  const [email, setEmail] = useState('admin@unt.edu.pe');
  const [password, setPassword] = useState('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#164694] to-[#0F2F63]">
      <motion.div 
        className={`w-full max-w-6xl mx-3 rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row ${darkMode ? 'bg-slate-900' : 'bg-white'}`}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Col1: Photo/Logo Section (Left on Desktop, Top on Mobile) */}
        <motion.div 
          className="flex-1 p-6 md:p-10 flex flex-col items-center justify-center text-center relative bg-gradient-to-b from-[#173F73] via-[#12345F] to-[#0B2347]"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        >
          {/* Dark Mode Toggle Button in Photo Section */}
          <button
            onClick={toggleDarkMode}
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all cursor-pointer border-none"
            style={{color: '#94a3b8'}}
          >
            {darkMode ? (
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <motion.div 
            className="relative w-24 h-24 md:w-40 md:h-40 rounded-2xl bg-white/15 mb-3 md:mb-6 p-2 md:p-3"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4, type: "spring", stiffness: 200 }}
            whileHover={{ scale: 1.05, rotate: 2 }}
          >
            <Image
              src="/logo.png"
              alt="Logo UNT"
              fill
              style={{objectFit:'contain',padding:'10px'}}
            />
          </motion.div>
          <motion.h1 
            className="text-xl md:text-3xl font-bold text-white mb-1 md:mb-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            Horarios UNT
          </motion.h1>
          <motion.p 
            className="text-xs md:text-base text-blue-200/90 mb-0.5 md:mb-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            Escuela de Ingeniería de Sistemas
          </motion.p>
          <motion.p 
            className="text-xs md:text-sm text-blue-200/70"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            Universidad Nacional de Trujillo
          </motion.p>
        </motion.div>

        {/* Col2: Login Form Section (Right on Desktop, Bottom on Mobile) */}
        <motion.div 
          className={`flex-1 p-6 md:p-10 flex flex-col justify-center ${darkMode ? 'bg-slate-900' : 'bg-white'}`}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
        >
          <motion.h2 
            className={`text-lg md:text-2xl font-semibold mb-4 md:mb-6 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            Iniciar sesión
          </motion.h2>

          {error && (
            <motion.div 
              className="alert alert-error"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" className="flex-shrink-0">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </motion.div>
          )}

          <form onSubmit={handleLogin}>
            <motion.div 
              className="form-group mb-3 md:mb-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
            >
              <label className={`form-label text-xs md:text-sm ${darkMode ? 'text-slate-300' : ''}`}>Correo electrónico</label>
              <input type="email" className="form-input text-sm md:text-base" value={email} onChange={e => setEmail(e.target.value)} required />
            </motion.div>
            <motion.div 
              className="form-group mb-3 md:mb-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <label className={`form-label text-xs md:text-sm ${darkMode ? 'text-slate-300' : ''}`}>Contraseña</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="form-input text-sm md:text-base pr-10" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-0 flex items-center justify-center"
                  style={{color: darkMode ? '#94a3b8' : '#64748b'}}
                >
                  {showPassword ? (
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </motion.div>
            <motion.button 
              type="submit" 
              className="btn-primary w-full justify-center py-2.5 md:py-3.5 mt-1 md:mt-2 text-sm md:text-base" 
              disabled={loading}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9 }}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
            >
              {loading ? 'Ingresando...' : 'Ingresar al sistema'}
            </motion.button>
          </form>

          <motion.div 
            className={`mt-4 md:mt-6 pt-3 md:pt-5 border-t ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.1 }}
          >
            <p className={`text-xs md:text-sm text-center mb-2 md:mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>Credenciales de prueba</p>
            <div className="grid grid-cols-2 gap-2 md:gap-3 text-xs md:text-sm">
              <motion.div 
                className={`rounded-lg md:rounded-xl p-2 md:p-3 ${darkMode ? 'bg-slate-800' : 'bg-slate-50'}`}
                whileHover={{ scale: 1.03, y: -2 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <p className={`font-semibold mb-0.5 md:mb-1 text-xs md:text-sm ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>Admin</p>
                <p className={`mb-0.5 md:mb-0.5 text-xs md:text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>admin@unt.edu.pe</p>
                <p className={`m-0 text-xs md:text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>password</p>
              </motion.div>
              <motion.div 
                className={`rounded-lg md:rounded-xl p-2 md:p-3 ${darkMode ? 'bg-slate-800' : 'bg-slate-50'}`}
                whileHover={{ scale: 1.03, y: -2 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <p className={`font-semibold mb-0.5 md:mb-1 text-xs md:text-sm ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>Secretaria</p>
                <p className={`mb-0.5 md:mb-0.5 text-xs md:text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>secretaria@unt.edu.pe</p>
                <p className={`m-0 text-xs md:text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>password</p>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}