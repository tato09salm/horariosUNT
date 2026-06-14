'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/lib/theme';

interface Docente {
  id: string;
  nombre: string;
  apellidos: string;
  codigo: string;
  categoria: string;
  condicion: string;
}

interface Curso {
  id: string;
  codigo: string;
  nombre: string;
  ciclo_plan: number;
}

interface CargaHorariaCurso {
  curso_id: string;
  seccion: string;
  escuela: string;
  num_alumnos: number;
  hrs_teo: number;
  hrs_pra: number;
  hrs_lab: number;
  total_hrs: number;
}

export default function FormCargaHorariaPage({ params }: { params: { docenteId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { darkMode } = useTheme();

  const cicloAcademicoId = searchParams.get('cicloAcademico');
  const cicloPlan = searchParams.get('cicloPlan');

  const [docente, setDocente] = useState<Docente | null>(null);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [cursosSeleccionados, setCursosSeleccionados] = useState<CargaHorariaCurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    modalidad: '',
    preparacion: { horas: 0, descripcion: '' },
    consejeria: { horas: 0, detalles: '' },
    investigacion: { horas: 0, proyecto: '' },
    capacitacion: { horas: 0, detalles: '' },
    gobierno: { horas: 0, detalles: '' },
    administracion: { horas: 0, detalles: '' },
    asesoria: { horas: 0, detalles: '' },
    rsu: { horas: 0, plan: '' },
    comites: { horas: 0, detalles: '' }
  });

  // Load docente and cursos
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load docente
        const docenteRes = await fetch(`/api/docentes/${params.docenteId}`);
        const docenteData = await docenteRes.json();
        setDocente(docenteData.data);

        // Load cursos
        const cursosRes = await fetch('/api/cursos');
        const cursosData = await cursosRes.json();
        setCursos(cursosData.data || []);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };
    if (params.docenteId) loadData();
  }, [params.docenteId]);

  // Add curso
  const addCurso = (cursoId: string) => {
    const curso = cursos.find(c => c.id === cursoId);
    if (curso) {
      setCursosSeleccionados([
        ...cursosSeleccionados,
        {
          curso_id: curso.id,
          seccion: 'A',
          escuela: 'Ing. Sistemas',
          num_alumnos: 40,
          hrs_teo: curso.horas_teoria || 0,
          hrs_pra: curso.horas_practica || 0,
          hrs_lab: 0,
          total_hrs: (curso.horas_teoria || 0) + (curso.horas_practica || 0)
        }
      ]);
    }
  };

  // Remove curso
  const removeCurso = (index: number) => {
    setCursosSeleccionados(cursosSeleccionados.filter((_, i) => i !== index));
  };

  // Update curso
  const updateCurso = (index: number, field: keyof CargaHorariaCurso, value: any) => {
    const updated = [...cursosSeleccionados];
    let processedValue = value;
    if (['num_alumnos', 'hrs_teo', 'hrs_pra', 'hrs_lab'].includes(field)) {
      const numValue = typeof value === 'string' ? parseInt(value) : value;
      if (isNaN(numValue) || numValue < 0) {
        processedValue = 0;
      }
    }
    updated[index] = { ...updated[index], [field]: processedValue };
    // Recalculate total hours
    if (['hrs_teo', 'hrs_pra', 'hrs_lab'].includes(field)) {
      updated[index].total_hrs = 
        (updated[index].hrs_teo || 0) + 
        (updated[index].hrs_pra || 0) + 
        (updated[index].hrs_lab || 0);
    }
    setCursosSeleccionados(updated);
  };

  // Save
  const handleSave = async () => {
    if (!formData.modalidad) {
      setAlertMessage('Por favor seleccione una modalidad');
      return;
    }

    if (cursosSeleccionados.length === 0) {
      setAlertMessage('Por favor agregue al menos un curso');
      return;
    }

    // First calculate total horas
    const totalHoras = 
      cursosSeleccionados.reduce((sum, c) => sum + (c.total_hrs || 0), 0) +
      formData.preparacion.horas +
      formData.consejeria.horas +
      formData.investigacion.horas +
      formData.capacitacion.horas +
      formData.gobierno.horas +
      formData.administracion.horas +
      formData.asesoria.horas +
      formData.rsu.horas +
      formData.comites.horas;

    if (totalHoras <= 0) {
      setAlertMessage('El total de horas debe ser mayor a 0');
      return;
    }

    // Check that all cursos have num_alumnos > 0
    const cursosSinAlumnos = cursosSeleccionados.filter(c => c.num_alumnos <= 0);
    if (cursosSinAlumnos.length > 0) {
      setAlertMessage('Todos los cursos deben tener al menos 1 alumno');
      return;
    }

    setSaving(true);
    try {
      // First create the carga horaria
      const cargaRes = await fetch('/api/carga-horaria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docente_id: params.docenteId,
          ciclo_academico_id: cicloAcademicoId,
          ciclo_plan: parseInt(cicloPlan || '1'),
          horas_asignadas: totalHoras,
          modalidad: formData.modalidad
        })
      });

      const cargaData = await cargaRes.json();
      const cargaId = cargaData.data.id;

      // Save cursos
      for (const curso of cursosSeleccionados) {
        await fetch('/api/carga-horaria-cursos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...curso, carga_horaria_id: cargaId })
        });
      }

      // Save other sections
      await fetch('/api/carga-horaria-preparacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData.preparacion, carga_horaria_id: cargaId })
      });

      await fetch('/api/carga-horaria-consejeria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData.consejeria, carga_horaria_id: cargaId })
      });

      await fetch('/api/carga-horaria-investigacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData.investigacion, carga_horaria_id: cargaId })
      });

      await fetch('/api/carga-horaria-capacitacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData.capacitacion, carga_horaria_id: cargaId })
      });

      await fetch('/api/carga-horaria-gobierno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData.gobierno, carga_horaria_id: cargaId })
      });

      await fetch('/api/carga-horaria-administracion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData.administracion, carga_horaria_id: cargaId })
      });

      await fetch('/api/carga-horaria-asesoria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData.asesoria, carga_horaria_id: cargaId })
      });

      await fetch('/api/carga-horaria-rsu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData.rsu, carga_horaria_id: cargaId })
      });

      await fetch('/api/carga-horaria-comites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData.comites, carga_horaria_id: cargaId })
      });

      router.push('/carga-horaria');
    } catch (err) {
      console.error('Error saving:', err);
      alert('Error al guardar la carga horaria');
    } finally {
      setSaving(false);
    }
  };

  // Roman numeral
  function getRomanNumeral(num: number): string {
    const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return romanNumerals[num - 1] || num.toString();
  }

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          Cargando...
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 4px' }}>
          Carga Horaria - {docente?.apellidos}, {docente?.nombre}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
          Ciclo {getRomanNumeral(parseInt(cicloPlan || '1'))}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Docente Info */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Datos del Docente
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Nombre Completo
              </label>
              <div style={{ fontWeight: '500' }}>
                {docente?.apellidos}, {docente?.nombre}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Categoría
              </label>
              <div style={{ fontWeight: '500' }}>
                {docente?.categoria}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Condición
              </label>
              <div style={{ fontWeight: '500' }}>
                {docente?.condicion}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Modalidad
              </label>
              <select
                value={formData.modalidad}
                onChange={e => setFormData({ ...formData, modalidad: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)'
                }}
              >
                <option value="">Selecciona...</option>
                <option value="Tiempo Completo 40 H">Tiempo Completo 40 H</option>
                <option value="Tiempo Parcial">Tiempo Parcial</option>
              </select>
            </div>
          </div>
        </div>

        {/* 1. Trabajo Lectivo - Cursos */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
              1. Trabajo Lectivo
            </h3>
            <select
              onChange={e => e.target.value && addCurso(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)'
              }}
              value=""
            >
              <option value="">Agregar curso...</option>
              {cursos.map(curso => (
                <option key={curso.id} value={curso.id}>
                  {curso.codigo} - {curso.nombre}
                </option>
              ))}
            </select>
          </div>

          {cursosSeleccionados.length > 0 ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Curso</th>
                    <th>Sección</th>
                    <th>Escuela</th>
                    <th>Alumnos</th>
                    <th>Hrs Teo</th>
                    <th>Hrs Pra</th>
                    <th>Hrs Lab</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cursosSeleccionados.map((cursoSel, index) => {
                    const curso = cursos.find(c => c.id === cursoSel.curso_id);
                    return (
                      <tr key={index}>
                        <td>
                          <div style={{ fontWeight: '500' }}>{curso?.nombre}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {curso?.codigo}
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={cursoSel.seccion}
                            onChange={e => updateCurso(index, 'seccion', e.target.value)}
                            style={{
                              width: '60px',
                              padding: '6px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-card)'
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={cursoSel.escuela}
                            onChange={e => updateCurso(index, 'escuela', e.target.value)}
                            style={{
                              width: '150px',
                              padding: '6px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-card)'
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={cursoSel.num_alumnos}
                            onChange={e => updateCurso(index, 'num_alumnos', parseInt(e.target.value))}
                            onWheel={(e) => e.preventDefault()}
                            style={{
                              width: '70px',
                              padding: '6px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-card)'
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={cursoSel.hrs_teo}
                            onChange={e => updateCurso(index, 'hrs_teo', parseInt(e.target.value))}
                            onWheel={(e) => e.preventDefault()}
                            style={{
                              width: '60px',
                              padding: '6px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-card)'
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={cursoSel.hrs_pra}
                            onChange={e => updateCurso(index, 'hrs_pra', parseInt(e.target.value))}
                            onWheel={(e) => e.preventDefault()}
                            style={{
                              width: '60px',
                              padding: '6px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-card)'
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={cursoSel.hrs_lab}
                            onChange={e => updateCurso(index, 'hrs_lab', parseInt(e.target.value))}
                            onWheel={(e) => e.preventDefault()}
                            style={{
                              width: '60px',
                              padding: '6px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-card)'
                            }}
                          />
                        </td>
                        <td style={{ fontWeight: '600' }}>
                          {cursoSel.total_hrs}
                        </td>
                        <td>
                          <button
                            className="btn-secondary btn-crud-deactivate"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => removeCurso(index)}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
              No hay cursos agregados
            </p>
          )}
        </div>

        {/* 2. Preparación y Evaluación */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
            2. Preparación y Evaluación
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '12px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Horas
              </label>
              <input
                type="number"
                min="0"
                value={formData.preparacion.horas}
                onChange={e => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val) || val < 0) val = 0;
                  setFormData({
                    ...formData,
                    preparacion: { ...formData.preparacion, horas: val }
                  });
                }}
                onWheel={(e) => e.preventDefault()}
                className="form-input"
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Descripción
              </label>
              <textarea
                value={formData.preparacion.descripcion}
                onChange={e => setFormData({
                  ...formData,
                  preparacion: { ...formData.preparacion, descripcion: e.target.value }
                })}
                className="form-input"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* 3. Consejería y Tutoría */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
            3. Consejería y Tutoría
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '12px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Horas
              </label>
              <input
                type="number"
                min="0"
                value={formData.consejeria.horas}
                onChange={e => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val) || val < 0) val = 0;
                  setFormData({
                    ...formData,
                    consejeria: { ...formData.consejeria, horas: val }
                  });
                }}
                onWheel={(e) => e.preventDefault()}
                className="form-input"
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Detalles
              </label>
              <textarea
                value={formData.consejeria.detalles}
                onChange={e => setFormData({
                  ...formData,
                  consejeria: { ...formData.consejeria, detalles: e.target.value }
                })}
                className="form-input"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* 4. Investigación */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
            4. Investigación
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '12px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Horas
              </label>
              <input
                type="number"
                min="0"
                value={formData.investigacion.horas}
                onChange={e => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val) || val < 0) val = 0;
                  setFormData({
                    ...formData,
                    investigacion: { ...formData.investigacion, horas: val }
                  });
                }}
                onWheel={(e) => e.preventDefault()}
                className="form-input"
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Proyecto
              </label>
              <textarea
                value={formData.investigacion.proyecto}
                onChange={e => setFormData({
                  ...formData,
                  investigacion: { ...formData.investigacion, proyecto: e.target.value }
                })}
                className="form-input"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* 5. Capacitación */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
            5. Capacitación
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '12px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Horas
              </label>
              <input
                type="number"
                min="0"
                value={formData.capacitacion.horas}
                onChange={e => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val) || val < 0) val = 0;
                  setFormData({
                    ...formData,
                    capacitacion: { ...formData.capacitacion, horas: val }
                  });
                }}
                onWheel={(e) => e.preventDefault()}
                className="form-input"
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Detalles
              </label>
              <textarea
                value={formData.capacitacion.detalles}
                onChange={e => setFormData({
                  ...formData,
                  capacitacion: { ...formData.capacitacion, detalles: e.target.value }
                })}
                className="form-input"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* 6. Actividades de Gobierno */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
            6. Actividades de Gobierno
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '12px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Horas
              </label>
              <input
                type="number"
                min="0"
                value={formData.gobierno.horas}
                onChange={e => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val) || val < 0) val = 0;
                  setFormData({
                    ...formData,
                    gobierno: { ...formData.gobierno, horas: val }
                  });
                }}
                onWheel={(e) => e.preventDefault()}
                className="form-input"
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Detalles
              </label>
              <textarea
                value={formData.gobierno.detalles}
                onChange={e => setFormData({
                  ...formData,
                  gobierno: { ...formData.gobierno, detalles: e.target.value }
                })}
                className="form-input"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* 7. Actividades de Administración */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
            7. Actividades de Administración
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '12px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Horas
              </label>
              <input
                type="number"
                min="0"
                value={formData.administracion.horas}
                onChange={e => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val) || val < 0) val = 0;
                  setFormData({
                    ...formData,
                    administracion: { ...formData.administracion, horas: val }
                  });
                }}
                onWheel={(e) => e.preventDefault()}
                className="form-input"
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Detalles
              </label>
              <textarea
                value={formData.administracion.detalles}
                onChange={e => setFormData({
                  ...formData,
                  administracion: { ...formData.administracion, detalles: e.target.value }
                })}
                className="form-input"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* 8. Asesoría de Tesis */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
            8. Asesoría de Tesis, Exámenes Profesionales y Experiencia Profesional
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '12px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Horas
              </label>
              <input
                type="number"
                min="0"
                value={formData.asesoria.horas}
                onChange={e => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val) || val < 0) val = 0;
                  setFormData({
                    ...formData,
                    asesoria: { ...formData.asesoria, horas: val }
                  });
                }}
                onWheel={(e) => e.preventDefault()}
                className="form-input"
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Detalles
              </label>
              <textarea
                value={formData.asesoria.detalles}
                onChange={e => setFormData({
                  ...formData,
                  asesoria: { ...formData.asesoria, detalles: e.target.value }
                })}
                className="form-input"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* 9. Responsabilidad Social Universitaria */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
            9. Responsabilidad Social Universitaria
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '12px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Horas
              </label>
              <input
                type="number"
                min="0"
                value={formData.rsu.horas}
                onChange={e => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val) || val < 0) val = 0;
                  setFormData({
                    ...formData,
                    rsu: { ...formData.rsu, horas: val }
                  });
                }}
                onWheel={(e) => e.preventDefault()}
                className="form-input"
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Plan
              </label>
              <textarea
                value={formData.rsu.plan}
                onChange={e => setFormData({
                  ...formData,
                  rsu: { ...formData.rsu, plan: e.target.value }
                })}
                className="form-input"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* 10. Comités Técnicos y Comisiones */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
            10. Comités Técnicos y Comisiones
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '12px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Horas
              </label>
              <input
                type="number"
                min="0"
                value={formData.comites.horas}
                onChange={e => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val) || val < 0) val = 0;
                  setFormData({
                    ...formData,
                    comites: { ...formData.comites, horas: val }
                  });
                }}
                onWheel={(e) => e.preventDefault()}
                className="form-input"
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Detalles
              </label>
              <textarea
                value={formData.comites.detalles}
                onChange={e => setFormData({
                  ...formData,
                  comites: { ...formData.comites, detalles: e.target.value }
                })}
                className="form-input"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="card" style={{ padding: '20px', background: '#f0fdf4', borderColor: '#86efac' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
              Total de Horas
            </h3>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#166534' }}>
              {
                cursosSeleccionados.reduce((sum, c) => sum + (c.total_hrs || 0), 0) +
                formData.preparacion.horas +
                formData.consejeria.horas +
                formData.investigacion.horas +
                formData.capacitacion.horas +
                formData.gobierno.horas +
                formData.administracion.horas +
                formData.asesoria.horas +
                formData.rsu.horas +
                formData.comites.horas
              }
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '40px' }}>
          <button
            className="btn-secondary"
            onClick={() => router.push('/carga-horaria')}
          >
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar Carga Horaria'}
          </button>
        </div>

      {/* Custom Alert Modal */}
      {alertMessage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            maxWidth: '400px',
            width: '90%'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#fee2e2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#dc2626',
                fontSize: '20px',
                fontWeight: 'bold'
              }}>
                !
              </div>
              <h3 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827'
              }}>
                Atención
              </h3>
            </div>
            <p style={{
              margin: 0,
              marginBottom: '20px',
              fontSize: '14px',
              color: '#4b5563',
              lineHeight: '1.5'
            }}>
              {alertMessage}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
                onClick={() => setAlertMessage(null)}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
