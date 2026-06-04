import ExcelJS from 'exceljs';
import { generarGrillaSemanal, BloqueAgrupado } from '../utils-excel';

export async function generarHojaDocente(
  workbook: ExcelJS.Workbook,
  datos: any,
  docente: any
) {
  // Construimos variantes del nombre completo (Nombres Apellidos / Apellidos, Nombres)
  const nombrePila = (docente.nombre || '').toLowerCase().trim();
  const apellidos = (docente.apellidos || '').toLowerCase().trim();
  const nombreCompleto = `${nombrePila} ${apellidos}`.trim();
  const nombreInvertido = `${apellidos}, ${nombrePila}`.trim();

  console.log('🔍 Filtrando bloques para docente:', nombreCompleto);
  console.log('📋 Total bloques disponibles:', datos.bloquesAgrupados.length);
  
  const bloquesDocente = datos.bloquesAgrupados.filter(
    (b: BloqueAgrupado & { docente_id?: any }) => {
      // 1. Comparación segura de IDs (evita fallos de string vs number)
      if (docente.id && b.docente_id && String(b.docente_id) === String(docente.id)) {
        return true;
      }
      
      // 2. Fallback: Comparación robusta por nombre completo
      const nombreBloque = (b.docente_nombre || '').toLowerCase().trim();
      
      if (!nombreBloque) return false;

      return (
        nombreBloque === nombreCompleto || 
        nombreBloque === nombreInvertido || 
        nombreBloque.includes(apellidos) || // Si el bloque contiene al menos sus apellidos
        nombreCompleto.includes(nombreBloque)
      );
    }
  );
  
  console.log('✅ Bloques encontrados para', docente.nombre, ':', bloquesDocente.length);
  bloquesDocente.forEach((b: any) => console.log('  →', b.curso_nombre, b.dia, b.hora_inicio));
  
  // Usamos solo el primer nombre/apellido para evitar que el nombre de la hoja supere los 31 caracteres
  const nombreHojaSeguro = `Doc-${(docente.apellidos || docente.nombre || 'Desconocido').split(/[\s,]+/)[0]}`.substring(0, 31);
  
  await generarGrillaSemanal(workbook, nombreHojaSeguro, {
    titulo: `HORARIO DOCENTE: ${docente.apellidos ? `${docente.apellidos}, ${docente.nombre}` : docente.nombre}`,
    subtitulo: `Categoría: ${docente.categoria?.replace('_',' ')?.toUpperCase() || 'DOCENTE'} · Condición: ${docente.condicion?.toUpperCase() || 'NOMBRADO'}`,
    bloques: bloquesDocente,
    mapaColores: datos.mapaColores,
    tabColor: 'FFDC2626'
  });
}
