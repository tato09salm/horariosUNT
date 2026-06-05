'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '@/lib/theme';

interface Grupo {
  id: string; ciclo_id: string; curso_id: string;
  numero_grupo: number; max_alumnos: number; num_alumnos: number;
  ciclo_nombre?: string; curso_codigo?: string; curso_nombre?: string;
}
interface Ciclo { id: string; nombre: string; año: number; semestre: string; }
interface Curso { id: string; codigo: string; nombre: string; }

const emptyGrupo = { ciclo_id:'', curso_id:'', numero_grupo:1, max_alumnos:30, num_alumnos:0 };

export default function GruposPage() {
  return (
    <div className="page-container">
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'50vh',textAlign:'center'}}>
        <h1 style={{fontSize:'24px',fontWeight:'700',margin:'0 0 8px'}}>Grupos (Desactivado)</h1>
        <p style={{color:'var(--text-secondary)',fontSize:'16px',margin:0}}>Esta funcionalidad ya no está disponible.</p>
      </div>
    </div>
  );
}