'use client';
import { useState, useEffect, useRef } from 'react';

const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado'];
const DIAS_L: Record<string,string> = {lunes:'Lunes',martes:'Martes',miercoles:'Miércoles',jueves:'Jueves',viernes:'Viernes',sabado:'Sábado'};

export default function ReportesPage() {
  const [ciclos, setCiclos] = useState<any[]>([]);
  const [cicloId, setCicloId] = useState('');
  const [docentes, setDocentes] = useState<any[]>([]);
  const [ambientes, setAmbientes] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [tipoReporte, setTipoReporte] = useState<'operacional'|'gestion'|'docente'>('operacional');
  const [docenteId, setDocenteId] = useState('');
  const [ambienteId, setAmbienteId] = useState('');
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [dashData, setDashData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/ciclos').then(r=>r.json()).then(d=>{
      setCiclos(d.data||[]);
      const a = d.data?.find((c:any)=>c.activo);
      if(a) setCicloId(a.id);
    });
    fetch('/api/docentes').then(r=>r.json()).then(d=>setDocentes(d.data||[]));
    fetch('/api/aulas').then(r=>r.json()).then(d=>setAmbientes(d.data||[]));
    fetch('/api/dashboard').then(r=>r.json()).then(d=>{ setSlots(d.slots||[]); setDashData(d); });
  }, []);

  async function generarReporte() {
    if (!cicloId) return;
    setLoading(true);
    setHasSearched(false);
    try {
      const q = new URLSearchParams({ciclo_id:cicloId});
      if (tipoReporte==='docente' && docenteId) q.set('docente_id',docenteId);
      if (tipoReporte==='operacional' && ambienteId) q.set('ambiente_id',ambienteId);
      const res = await fetch(`/api/horarios?${q}`);
      const data = await res.json();
      setAsignaciones(data.data||[]);
      if (cicloId) {
        const d = await fetch(`/api/dashboard?ciclo_id=${cicloId}`).then(r=>r.json());
        setDashData(d);
      }
    } finally { 
      setLoading(false); 
      setHasSearched(true);
    }
  }

  async function exportarPDF() {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const { generarMapaColores, obtenerColorCurso } = await import('@/lib/colores-curso');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const ciclo = ciclos.find(c=>c.id===cicloId);
    const nombreCiclo = ciclo?.nombre || '';

    function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    }

    interface BloqueAgrupado {
      curso_codigo: string;
      curso_nombre: string;
      grupo: string;
      aula: string;
      docente_nombre: string;
      tipo_sesion: string;
      dia: string;
      hora_inicio: string;
      hora_fin: string;
      duracion_horas: number;
      ciclo: number;
    }

    function agruparBloquesContiguos(asigList: any[]): BloqueAgrupado[] {
      const ordenDias = (dia: string): number => {
        const orden = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        return orden.indexOf(dia.toLowerCase());
      };

      const ordenadas = [...asigList].sort((a, b) => {
        if (a.dia !== b.dia) return ordenDias(a.dia) - ordenDias(b.dia);
        return a.hora_inicio.localeCompare(b.hora_inicio);
      });
      
      const bloques: BloqueAgrupado[] = [];
      let bloqueActual: BloqueAgrupado | null = null;
      
      for (const asig of ordenadas) {
        const currentCycle = asig.ciclo_plan || asig.ciclo || 0;
        const isContinuation = bloqueActual && 
          bloqueActual.dia === asig.dia &&
          bloqueActual.curso_codigo === asig.curso_codigo &&
          bloqueActual.grupo === `G${asig.numero_grupo || asig.grupo}` &&
          bloqueActual.aula === (asig.ambiente_codigo || asig.aula || asig.ambiente_nombre) &&
          bloqueActual.docente_nombre === asig.docente_nombre &&
          bloqueActual.tipo_sesion === asig.tipo &&
          bloqueActual.hora_fin === asig.hora_inicio;

        if (isContinuation && bloqueActual) {
          bloqueActual.hora_fin = asig.hora_fin;
          bloqueActual.duracion_horas += 1;
        } else {
          if (bloqueActual) bloques.push(bloqueActual);
          
          bloqueActual = {
            curso_codigo: asig.curso_codigo || '',
            curso_nombre: asig.curso_nombre || '',
            grupo: `G${asig.numero_grupo || asig.grupo || ''}`,
            aula: asig.ambiente_codigo || asig.aula || asig.ambiente_nombre || '',
            docente_nombre: asig.docente_nombre || '',
            tipo_sesion: asig.tipo || '',
            dia: asig.dia,
            hora_inicio: asig.hora_inicio,
            hora_fin: asig.hora_fin,
            duracion_horas: 1,
            ciclo: currentCycle
          };
        }
      }
      
      if (bloqueActual) bloques.push(bloqueActual);
      return bloques;
    }

    let y = 62;

    if (tipoReporte === 'gestion') {
      // Encabezado Formal
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59); // Slate 800
      doc.text('UNIVERSIDAD NACIONAL DE TRUJILLO', 148.5, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text('Facultad de Ingeniería - Escuela de Ingeniería de Sistemas', 148.5, 28, { align: 'center' });
      
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.line(14, 35, 283, 35);
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`REPORTE DE GESTIÓN — ${ciclo?.nombre||''}`, 14, 45);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 52);

      // Estadísticas
      doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59);
      doc.text('RESUMEN EJECUTIVO', 14, y); y += 6;

      doc.setFontSize(9); doc.setFont('helvetica','normal');
      const stats = [
        ['Docentes programados', `${dashData?.stats?.totalDocentes} de ${dashData?.stats?.globalDocentes||0} (${Math.round((dashData?.stats?.totalDocentes / (dashData?.stats?.globalDocentes||1))*100)}%)`],
        ['Cursos programados', `${dashData?.stats?.totalCursos} de ${dashData?.stats?.globalCursos||0} (${Math.round((dashData?.stats?.totalCursos / (dashData?.stats?.globalCursos||1))*100)}%)`],
        ['Ambientes usados', `${dashData?.stats?.totalAmbientes} de ${dashData?.stats?.globalAmbientes||0} (${Math.round((dashData?.stats?.totalAmbientes / (dashData?.stats?.globalAmbientes||1))*100)}%)`],
        ['Total asignaciones', `${dashData?.stats?.totalAsignaciones}`],
      ];
      autoTable(doc, {
        startY: y, head:[['Indicador','Valor']],
        body: stats, theme:'striped',
        headStyles:{fillColor:[30, 41, 59], textColor:[255, 255, 255], fontStyle:'bold'},
        bodyStyles:{textColor:[51, 65, 85]},
        margin:{left:14,right:14},
        tableWidth: 100,
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // Carga docentes
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59);
      doc.text('CARGA HORARIA POR DOCENTE', 14, y); y += 6;
      autoTable(doc, {
        startY: y,
        head:[['Docente','Categoría','Condición','Horas Asignadas','Horas Máx.','% Carga']],
        body: dashData?.cargaDocentes?.map((d:any)=>[
          d.nombre, d.categoria.replace('_',' ').toUpperCase(), d.condicion,
          `${d.horas_asignadas}h`, `${d.horas_max_semana}h`, `${d.porcentaje_carga||0}%`
        ])||[],
        theme:'striped', 
        headStyles:{fillColor:[30, 41, 59], textColor:[255, 255, 255], fontStyle:'bold', halign:'center'},
        bodyStyles:{textColor:[51, 65, 85], fontSize:8},
        columnStyles: { 3:{halign:'center'}, 4:{halign:'center'}, 5:{halign:'center'} },
        margin:{left:14,right:14},
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // Ocupación ambientes
      if (y > 160) { doc.addPage(); y = 20; }
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59);
      doc.text('OCUPACIÓN DE AMBIENTES', 14, y); y += 6;
      autoTable(doc, {
        startY: y,
        head:[['Ambiente','Tipo','Horas Usadas','% Ocupación']],
        body: dashData?.ocupacionAmbientes?.map((a:any)=>[
          a.nombre, a.tipo.toUpperCase(), `${a.horas_usadas}h`, `${a.porcentaje}%`
        ])||[],
        theme:'striped',
        headStyles:{fillColor:[30, 41, 59], textColor:[255, 255, 255], fontStyle:'bold', halign:'center'},
        bodyStyles:{textColor:[51, 65, 85], fontSize:8},
        columnStyles: { 2:{halign:'center'}, 3:{halign:'center'} },
        margin:{left:14,right:14},
      });
    } else {
      // Reporte operacional semanal agrupado y pintado
      const docGrp: Record<string,any[]> = {};
      asignaciones.forEach(a => {
        const k = tipoReporte==='docente' ? a.docente_nombre : a.ambiente_nombre;
        if (!docGrp[k]) docGrp[k] = [];
        docGrp[k].push(a);
      });

      const items = Object.entries(docGrp);
      items.forEach(([tituloGrp, grpAsignaciones], idxPage) => {
        if (idxPage > 0) doc.addPage();

        // Encabezado institucional de la página
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('UNIVERSIDAD NACIONAL DE TRUJILLO', 14, 15);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text('Facultad de Ingeniería - Escuela de Ingeniería de Sistemas', 14, 20);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        const subTitle = tipoReporte === 'docente' 
          ? `HORARIO SEMANAL DEL DOCENTE: ${tituloGrp.toUpperCase()}`
          : `HORARIO SEMANAL DEL AMBIENTE: ${tituloGrp.toUpperCase()}`;
        doc.text(`${subTitle} — ${nombreCiclo}`, 14, 26);

        doc.setDrawColor(226, 232, 240);
        doc.line(14, 29, 283, 29);

        // Agrupar bloques contiguos
        const bloquesAgrupados = agruparBloquesContiguos(grpAsignaciones);
        
        // Generar mapa de colores
        const mapaColores = generarMapaColores(grpAsignaciones);

        // Columnas y filas
        const diasSem = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const headersTable = ['Hora', ...diasSem];

        const sortedSlots = [...slots].sort((a,b)=>a.hora_inicio.localeCompare(b.hora_inicio));
        
        const rowsTable = sortedSlots.map(slot => {
          const horaIni = slot.hora_inicio.substring(0, 5);
          const horaFin = slot.hora_fin.substring(0, 5);
          const timeLabel = `${horaIni}\n${horaFin}`;
          const fila: any[] = [timeLabel];

          const isLunch = slot.hora_inicio.startsWith('13:00');
          if (isLunch) {
            diasSem.forEach(() => fila.push('HORA LIBRE (REFRIGERIO)'));
          } else {
            diasSem.forEach(d => {
              const bloquesEnCelda = bloquesAgrupados.filter(b => 
                b.dia.toLowerCase() === d.toLowerCase() &&
                b.hora_inicio <= slot.hora_inicio &&
                b.hora_fin > slot.hora_inicio
              );

              if (bloquesEnCelda.length === 0) {
                fila.push('');
              } else {
                const cellText = bloquesEnCelda.map(b => {
                  const typeLabel = b.tipo_sesion === 'asesoria' ? '[C]' : `[${b.tipo_sesion[0].toUpperCase()}]`;
                  const det = tipoReporte === 'docente' ? b.aula : b.docente_nombre;
                  return `${b.curso_nombre}\n${b.curso_codigo} ${typeLabel} - ${b.grupo}\n${det}\n(${b.hora_inicio.substring(0,5)} - ${b.hora_fin.substring(0,5)})`;
                }).join('\n---\n');
                fila.push(cellText);
              }
            });
          }

          return fila;
        });

        // Renderizar autoTable
        autoTable(doc, {
          head: [headersTable],
          body: rowsTable,
          startY: 33,
          theme: 'grid',
          styles: {
            fontSize: 7,
            cellPadding: 2.5,
            overflow: 'linebreak',
            valign: 'middle',
            halign: 'left',
            textColor: [51, 65, 85]
          },
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 8
          },
          columnStyles: {
            0: {
              cellWidth: 20,
              halign: 'center',
              fontStyle: 'bold',
              fillColor: [248, 250, 252]
            }
          },
          didParseCell: (data) => {
            if (data.section === 'body') {
              const textContent = String(data.cell.raw);
              if (textContent === 'HORA LIBRE (REFRIGERIO)') {
                data.cell.styles.fillColor = [241, 245, 249];
                data.cell.styles.textColor = [100, 116, 139];
                data.cell.styles.fontStyle = 'italic';
                data.cell.styles.halign = 'center';
                return;
              }

              if (data.column.index > 0) {
                const slot = sortedSlots[data.row.index];
                if (!slot) return;
                const dia = diasSem[data.column.index - 1];

                const bloque = bloquesAgrupados.find(b => 
                  b.dia.toLowerCase() === dia.toLowerCase() &&
                  b.hora_inicio <= slot.hora_inicio &&
                  b.hora_fin > slot.hora_inicio
                );

                if (bloque) {
                  if (bloque.tipo_sesion === 'asesoria') {
                    data.cell.styles.fillColor = [229, 231, 235]; // Gris neutro
                    data.cell.styles.lineColor = [107, 114, 128];
                    data.cell.styles.lineWidth = 0.4;
                  } else {
                    const color = obtenerColorCurso(mapaColores, bloque.ciclo, bloque.curso_codigo, bloque.tipo_sesion);
                    const rgb = hexToRgb(color.bg);
                    if (rgb) {
                      data.cell.styles.fillColor = [rgb.r, rgb.g, rgb.b];
                    }
                    const borderRgb = hexToRgb(color.border);
                    if (borderRgb) {
                      data.cell.styles.lineColor = [borderRgb.r, borderRgb.g, borderRgb.b];
                      data.cell.styles.lineWidth = 0.5;
                    }
                  }
                }
              }
            }
          }
        });

        // Leyenda de cursos de la página al final
        const finalY = (doc as any).lastAutoTable.finalY + 8;
        if (finalY < 185) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59);
          doc.text('Leyenda - Cursos representados', 14, finalY);

          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');

          const cursosUnicos = Array.from(new Map(grpAsignaciones.filter(a => a.tipo !== 'asesoria' && a.curso_codigo).map(a => [a.curso_codigo, a])).values());
          let yPos = finalY + 5;
          let xPos = 14;

          cursosUnicos.forEach((curso) => {
            const color = obtenerColorCurso(mapaColores, curso.ciclo_plan || curso.ciclo, curso.curso_codigo);
            const rgb = hexToRgb(color.bg);
            
            if (rgb) {
              doc.setFillColor(rgb.r, rgb.g, rgb.b);
              doc.setDrawColor(hexToRgb(color.border)?.r || 100, hexToRgb(color.border)?.g || 100, hexToRgb(color.border)?.b || 100);
              doc.rect(xPos, yPos - 3, 5, 4, 'FD');
              
              doc.setTextColor(51, 65, 85);
              const labelText = `${curso.curso_nombre} (${curso.curso_codigo})`;
              doc.text(labelText, xPos + 7, yPos);
            }
            
            yPos += 5;
            if (yPos > 200) {
              yPos = finalY + 5;
              xPos += 80;
            }
          });
        }
      });
    }
    const nombre = tipoReporte==='gestion' ? 'reporte-gestion' : tipoReporte==='docente' ? 'horario-docente' : 'reporte-operacional';
    doc.save(`${nombre}-${ciclo?.nombre||'unt'}.pdf`);
  }

  async function exportarExcel() {
    if (!cicloId) {
      alert('Por favor seleccione un ciclo');
      return;
    }
    setLoading(true);
    try {
      // 1. Encontrar la programación asociada al ciclo
      const progsRes = await fetch(`/api/horarios/programaciones?ciclo_id=${cicloId}`).then(r => r.json());
      const publishedProg = progsRes.data?.find((p: any) => p.estado === 'publicado') || progsRes.data?.[0];
      
      if (!publishedProg) {
        throw new Error('No se encontró ninguna programación para este ciclo.');
      }
      
      // 2. Obtener los datos estructurados
      const response = await fetch(`/api/horarios/programaciones/${publishedProg.id}/exportar`);
      if (!response.ok) {
        throw new Error('Error al obtener datos de exportación');
      }
      
      const resData = await response.json();
      
      // 3. Generar y descargar el libro Excel premium
      const { exportarHorariosExcel } = await import('@/lib/exportar/excel-horarios');
      await exportarHorariosExcel(resData);
    } catch (err: any) {
      alert(err.message || 'Error al exportar a Excel');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function exportarCSV() {
    const { utils, writeFile } = await import('xlsx');
    const ciclo = ciclos.find(c=>c.id===cicloId);
    let wb = utils.book_new();
    
    if (tipoReporte === 'gestion') {
      const rows = [['Indicador', 'Valor'],
        ['Docentes activos', dashData?.stats?.totalDocentes],
        ['Cursos activos', dashData?.stats?.totalCursos],
        ['Ambientes disponibles', dashData?.stats?.totalAmbientes],
        ['Total asignaciones', dashData?.stats?.totalAsignaciones]
      ];
      const ws = utils.aoa_to_sheet(rows);
      utils.book_append_sheet(wb, ws, 'Datos');
    } else {
      const rows = asignaciones.sort((a,b)=>DIAS.indexOf(a.dia)-DIAS.indexOf(b.dia)).map(r=>[
        DIAS_L[r.dia]||r.dia, r.hora_inicio, r.hora_fin, r.curso_nombre,
        tipoReporte==='docente' ? r.ambiente_nombre : r.docente_nombre,
        r.tipo, `G${r.numero_grupo}`
      ]);
      const data = [['Día','Hora Inicio','Hora Fin','Curso','Ambiente/Docente','Tipo','Grupo'], ...rows];
      const ws = utils.aoa_to_sheet(data);
      utils.book_append_sheet(wb, ws, 'Horarios');
    }
    
    const nombre = tipoReporte==='gestion' ? 'reporte-gestion' : tipoReporte==='docente' ? 'horario-docente' : 'reporte-operacional';
    writeFile(wb, `${nombre}-${ciclo?.nombre||'unt'}.csv`, { bookType: 'csv' });
  }

  const docenteSelec = docentes.find(d=>d.id===docenteId);

  // Organizar asignaciones para vista previa
  const porDocente: Record<string,any[]> = {};
  const porAmbiente: Record<string,any[]> = {};

  if (tipoReporte === 'docente' && docenteSelec) {
    porDocente[`${docenteSelec.nombre} ${docenteSelec.apellidos}`] = [];
  }
  if (tipoReporte === 'operacional' && ambienteId) {
    const amb = ambientes.find(a=>a.id===ambienteId);
    if (amb) porAmbiente[amb.nombre] = [];
  }

  asignaciones.forEach(a => {
    if (!porDocente[a.docente_nombre]) porDocente[a.docente_nombre] = [];
    porDocente[a.docente_nombre].push(a);
    if (!porAmbiente[a.ambiente_nombre]) porAmbiente[a.ambiente_nombre] = [];
    porAmbiente[a.ambiente_nombre].push(a);
  });

  return (
    <div style={{padding:'32px'}}>
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'24px',fontWeight:'700',color:'#1e293b',margin:'0 0 4px'}}>Reportes</h1>
        <p style={{color:'#64748b',fontSize:'14px',margin:0}}>Generación de reportes operacionales y de gestión en PDF, Excel y CSV</p>
      </div>

      {/* Config Panel */}
      <div className="card" style={{marginBottom:'20px'}}>
        <h3 style={{fontSize:'16px',fontWeight:'600',margin:'0 0 16px'}}>Configuración del reporte</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))',gap:'16px',marginBottom:'20px'}}>
          <div className="form-group" style={{margin:0}}>
            <label className="form-label" style={{color:'#475569', fontWeight:'600'}}>Tipo de reporte</label>
            <select 
              className="form-input" 
              style={{background:'#f8fafc', border:'1px solid #cbd5e1', borderRadius:'8px', padding:'10px 12px', transition:'all 0.2s', cursor:'pointer', color:'#1e293b', fontWeight:500, boxShadow:'0 1px 2px rgba(0,0,0,0.05)'}} 
              value={tipoReporte} 
              onChange={e=>{setTipoReporte(e.target.value as any); setHasSearched(false);}}
            >
              <option value="operacional">📋 Operacional (Aulas y Docentes)</option>
              <option value="docente">👤 Horario por Docente</option>
              <option value="gestion">📊 Gestión (Resumen Ejecutivo)</option>
            </select>
          </div>
          <div className="form-group" style={{margin:0}}>
            <label className="form-label" style={{color:'#475569', fontWeight:'600'}}>Ciclo académico</label>
            <select 
              className="form-input" 
              style={{background:'#f8fafc', border:'1px solid #cbd5e1', borderRadius:'8px', padding:'10px 12px', transition:'all 0.2s', cursor:'pointer', color:'#1e293b', fontWeight:500, boxShadow:'0 1px 2px rgba(0,0,0,0.05)'}} 
              value={cicloId} 
              onChange={e=>{setCicloId(e.target.value); setHasSearched(false);}}
            >
              {ciclos.map(c=><option key={c.id} value={c.id}>{c.nombre}{c.activo?' (Activo)':''}</option>)}
            </select>
          </div>
          {tipoReporte==='docente' && (
            <div className="form-group" style={{margin:0}}>
              <label className="form-label" style={{color:'#475569', fontWeight:'600'}}>Docente</label>
              <select 
                className="form-input" 
                style={{background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'8px', padding:'10px 12px', transition:'all 0.2s', cursor:'pointer', color:'#166534', fontWeight:500, boxShadow:'0 1px 2px rgba(0,0,0,0.05)'}} 
                value={docenteId} 
                onChange={e=>{setDocenteId(e.target.value); setHasSearched(false);}}
              >
                <option value="">Todos los docentes</option>
                {docentes.map(d=><option key={d.id} value={d.id}>[{d.categoria}] {d.apellidos}, {d.nombre}</option>)}
              </select>
            </div>
          )}
          {tipoReporte==='operacional' && (
            <div className="form-group" style={{margin:0}}>
              <label className="form-label" style={{color:'#475569', fontWeight:'600'}}>Filtrar por ambiente (opcional)</label>
              <select 
                className="form-input" 
                style={{background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'8px', padding:'10px 12px', transition:'all 0.2s', cursor:'pointer', color:'#166534', fontWeight:500, boxShadow:'0 1px 2px rgba(0,0,0,0.05)'}} 
                value={ambienteId} 
                onChange={e=>{setAmbienteId(e.target.value); setHasSearched(false);}}
              >
                <option value="">Todos los ambientes</option>
                {ambientes.map(a=><option key={a.id} value={a.id}>{a.codigo} — {a.nombre}</option>)}
              </select>
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:'12px'}}>
          <button className="btn-primary" onClick={generarReporte} disabled={loading}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            {loading ? 'Generando...' : 'Previsualizar'}
          </button>
          {hasSearched && (Object.keys(porDocente).length > 0 || Object.keys(porAmbiente).length > 0 || tipoReporte === 'gestion') && (
            <div style={{display:'flex',gap:'8px'}}>
              <button className="btn-secondary" onClick={exportarPDF}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                PDF
              </button>
              <button className="btn-secondary" onClick={exportarExcel}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Excel
              </button>
              <button className="btn-secondary" onClick={exportarCSV}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Vista previa */}
      {hasSearched && tipoReporte !== 'gestion' && (
        <div ref={reportRef}>
          {/* Cabecera reporte */}
          <div style={{background:'#1a3a5c',color:'white',borderRadius:'12px 12px 0 0',padding:'20px 24px',marginBottom:0}}>
            <p style={{fontSize:'12px',margin:'0 0 2px',opacity:0.7}}>UNIVERSIDAD NACIONAL DE TRUJILLO — Escuela de Ingeniería de Sistemas</p>
            <h2 style={{fontSize:'18px',fontWeight:'700',margin:'0 0 2px'}}>
              {tipoReporte==='docente' ? `Horario del Docente: ${docenteSelec ? `${docenteSelec.apellidos}, ${docenteSelec.nombre}` : 'Todos'}` : 'Reporte Operacional de Horarios'}
            </h2>
            <p style={{fontSize:'13px',margin:0,opacity:0.8}}>Ciclo: {ciclos.find(c=>c.id===cicloId)?.nombre} • Generado: {new Date().toLocaleDateString('es-PE')}</p>
          </div>

          {tipoReporte==='docente' && (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'20px', marginTop:'24px'}}>
              {Object.entries(porDocente).map(([docNombre, rows]) => {
                const totalHoras = rows.length;
                const cursosUnicos = Array.from(new Set(rows.map(r => r.curso_nombre)));
                return (
                  <div key={docNombre} className="card" style={{padding:'20px', display:'flex', flexDirection:'column', borderTop:'4px solid #1a3a5c'}}>
                    <h3 style={{fontSize:'16px',fontWeight:'700',color:'#1e293b',margin:'0 0 8px'}}>{docNombre}</h3>
                    <div style={{display:'flex', gap:'12px', marginBottom:'16px'}}>
                      <span style={{background:'#f1f5f9', color:'#475569', padding:'4px 10px', borderRadius:'6px', fontSize:'13px', fontWeight:'600'}}>📚 {cursosUnicos.length} Cursos</span>
                      <span style={{background:'#dbeafe', color:'#1e40af', padding:'4px 10px', borderRadius:'6px', fontSize:'13px', fontWeight:'600'}}>⏱️ {totalHoras} hrs asignadas</span>
                    </div>
                    <div style={{display:'flex', flexDirection:'column', gap:'8px', flex:1}}>
                      {rows.sort((a,b)=>DIAS.indexOf(a.dia)-DIAS.indexOf(b.dia)).slice(0, 5).map((r, i) => (
                        <div key={i} style={{display:'flex', justifyContent:'space-between', fontSize:'13px', padding:'8px', background:'#f8fafc', borderRadius:'6px', border:'1px solid #e2e8f0'}}>
                          <div style={{fontWeight:'500', color:'#334155'}}><span style={{textTransform:'capitalize', width:'70px', display:'inline-block'}}>{r.dia.substring(0,3)}.</span> {r.hora_inicio} - {r.hora_fin}</div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontWeight:'600', color:'#0f172a'}}>{r.curso_codigo} <span style={{color:'#64748b', fontSize:'11px'}}>(G{r.numero_grupo})</span></div>
                            <div style={{color:'#64748b', fontSize:'11px'}}>{r.ambiente_codigo} • <span style={{color:r.tipo==='teoria'?'#2563eb':r.tipo==='practica'?'#059669':'#d97706'}}>{r.tipo}</span></div>
                          </div>
                        </div>
                      ))}
                      {rows.length > 5 && (
                        <div style={{textAlign:'center', fontSize:'12px', color:'#64748b', marginTop:'4px', fontStyle:'italic'}}>+ {rows.length - 5} sesiones más...</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tipoReporte==='docente' && Object.keys(porDocente).length === 0 && (
            <div style={{padding:'40px',textAlign:'center',color:'#64748b',background:'#f8fafc',borderRadius:'12px',border:'1px dashed #cbd5e1', marginTop:'24px'}}>
              No hay horarios registrados para ningún docente en este ciclo.
            </div>
          )}

          {tipoReporte==='operacional' && (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'20px', marginTop:'24px'}}>
              {Object.entries(porAmbiente).map(([ambNombre, rows]) => {
                const totalHoras = rows.length;
                const cursosUnicos = Array.from(new Set(rows.map(r => r.curso_nombre)));
                return (
                  <div key={ambNombre} className="card" style={{padding:'20px', display:'flex', flexDirection:'column', borderTop:'4px solid #10b981'}}>
                    <h3 style={{fontSize:'16px',fontWeight:'700',color:'#1e293b',margin:'0 0 8px'}}>🚪 {ambNombre}</h3>
                    <div style={{display:'flex', gap:'12px', marginBottom:'16px'}}>
                      <span style={{background:'#f1f5f9', color:'#475569', padding:'4px 10px', borderRadius:'6px', fontSize:'13px', fontWeight:'600'}}>📚 {cursosUnicos.length} Cursos</span>
                      <span style={{background:'#d1fae5', color:'#065f46', padding:'4px 10px', borderRadius:'6px', fontSize:'13px', fontWeight:'600'}}>⏱️ {totalHoras} hrs de uso</span>
                    </div>
                    <div style={{display:'flex', flexDirection:'column', gap:'8px', flex:1}}>
                      {rows.sort((a,b)=>DIAS.indexOf(a.dia)-DIAS.indexOf(b.dia)).slice(0, 5).map((r, i) => (
                        <div key={i} style={{display:'flex', justifyContent:'space-between', fontSize:'13px', padding:'8px', background:'#f8fafc', borderRadius:'6px', border:'1px solid #e2e8f0'}}>
                          <div style={{fontWeight:'500', color:'#334155'}}><span style={{textTransform:'capitalize', width:'70px', display:'inline-block'}}>{r.dia.substring(0,3)}.</span> {r.hora_inicio} - {r.hora_fin}</div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontWeight:'600', color:'#0f172a'}}>{r.curso_codigo} <span style={{color:'#64748b', fontSize:'11px'}}>(G{r.numero_grupo})</span></div>
                            <div style={{color:'#64748b', fontSize:'11px', maxWidth:'120px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={r.docente_nombre}>{r.docente_nombre}</div>
                          </div>
                        </div>
                      ))}
                      {rows.length > 5 && (
                        <div style={{textAlign:'center', fontSize:'12px', color:'#64748b', marginTop:'4px', fontStyle:'italic'}}>+ {rows.length - 5} sesiones más...</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tipoReporte==='operacional' && Object.keys(porAmbiente).length === 0 && (
            <div style={{padding:'40px',textAlign:'center',color:'#64748b',background:'#f8fafc',borderRadius:'12px',border:'1px dashed #cbd5e1', marginTop:'24px'}}>
              No hay horarios registrados en ningún ambiente en este ciclo.
            </div>
          )}
        </div>
      )}

      {/* Reporte de gestión */}
      {tipoReporte==='gestion' && hasSearched && dashData && (
        <div>
          <div style={{background:'#1a3a5c',color:'white',borderRadius:'12px 12px 0 0',padding:'20px 24px'}}>
            <p style={{fontSize:'12px',margin:'0 0 2px',opacity:0.7}}>UNIVERSIDAD NACIONAL DE TRUJILLO — Escuela de Ingeniería de Sistemas</p>
            <h2 style={{fontSize:'18px',fontWeight:'700',margin:'0 0 2px'}}>Reporte de Gestión — Resumen Ejecutivo</h2>
            <p style={{fontSize:'13px',margin:0,opacity:0.8}}>Ciclo: {ciclos.find(c=>c.id===cicloId)?.nombre}</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',padding:'20px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
            {[
              {l:'Docentes',v:dashData.stats?.totalDocentes,c:'#1a3a5c'},
              {l:'Cursos',v:dashData.stats?.totalCursos,c:'#065f46'},
              {l:'Ambientes',v:dashData.stats?.totalAmbientes,c:'#92400e'},
              {l:'Asignaciones',v:dashData.stats?.totalAsignaciones,c:'#6b21a8'},
            ].map((s,i)=>(
              <div key={i} style={{background:'white',borderRadius:'10px',padding:'16px',textAlign:'center',boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}>
                <p style={{fontSize:'26px',fontWeight:'700',color:s.c,margin:'0 0 4px'}}>{s.v}</p>
                <p style={{fontSize:'12px',color:'#64748b',margin:0}}>{s.l}</p>
              </div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0',borderTop:'1px solid #e2e8f0'}}>
            <div style={{padding:'20px',borderRight:'1px solid #e2e8f0'}}>
              <h3 style={{fontSize:'14px',fontWeight:'600',color:'#1e293b',margin:'0 0 12px'}}>Carga horaria docentes</h3>
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                {dashData.cargaDocentes?.slice(0,8).map((d:any,i:number)=>(
                  <div key={i}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                      <span style={{fontSize:'12px',color:'#374151',fontWeight:'500',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.nombre}</span>
                      <span style={{fontSize:'11px',color:'#64748b',marginLeft:'8px',flexShrink:0}}>{d.horas_asignadas}/{d.horas_max_semana}h</span>
                    </div>
                    <div style={{background:'#f1f5f9',borderRadius:'9999px',height:'5px'}}>
                      <div style={{height:'100%',borderRadius:'9999px',background:parseFloat(d.porcentaje_carga)>90?'#dc2626':parseFloat(d.porcentaje_carga)>60?'#f59e0b':'#10b981',width:`${Math.min(parseFloat(d.porcentaje_carga),100)}%`}} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:'20px'}}>
              <h3 style={{fontSize:'14px',fontWeight:'600',color:'#1e293b',margin:'0 0 12px'}}>Ocupación de ambientes</h3>
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                {dashData.ocupacionAmbientes?.slice(0,8).map((a:any,i:number)=>(
                  <div key={i}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                      <span style={{fontSize:'12px',color:'#374151',fontWeight:'500'}}>{a.codigo} — {a.nombre}</span>
                      <span style={{fontSize:'11px',color:'#64748b'}}>{a.porcentaje}%</span>
                    </div>
                    <div style={{background:'#f1f5f9',borderRadius:'9999px',height:'5px'}}>
                      <div style={{height:'100%',borderRadius:'9999px',background:parseFloat(a.porcentaje)>70?'#dc2626':parseFloat(a.porcentaje)>40?'#f59e0b':'#10b981',width:`${Math.min(parseFloat(a.porcentaje),100)}%`}} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{padding:'16px 20px',borderTop:'1px solid #e2e8f0',textAlign:'right',display:'flex',justifyContent:'flex-end',gap:'8px'}}>
            <button className="btn-secondary" onClick={exportarCSV}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              CSV
            </button>
            <button className="btn-secondary" onClick={exportarExcel}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Excel
            </button>
            <button className="btn-secondary" onClick={exportarPDF}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              PDF
            </button>
          </div>
        </div>
      )}

      {!hasSearched && !loading && (
        <div style={{textAlign:'center',padding:'60px',color:'#94a3b8'}}>
          <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{margin:'0 auto 12px',display:'block',opacity:0.4}}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p style={{fontSize:'15px',margin:'0 0 4px'}}>Configure y previsualice el reporte</p>
          <p style={{fontSize:'13px',margin:0}}>Seleccione el tipo de reporte y haga clic en Previsualizar</p>
        </div>
      )}
    </div>
  );
}
