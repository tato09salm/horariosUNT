module.exports = {
  up: async (qi) => {
    const ciclos = (await qi.sequelize.query("SELECT id, nombre FROM ciclos;"))[0];
    const c_26_i = ciclos.find(c => c.nombre === '2026-I').id;
    const c_25_ii = ciclos.find(c => c.nombre === '2025-II').id;
    
    // Check if a programacion exists for these, else create
    let programaciones = (await qi.sequelize.query("SELECT id, ciclo_id FROM programaciones;"))[0];
    let p_26_i = programaciones.find(p => p.ciclo_id === c_26_i)?.id;
    let p_25_ii = programaciones.find(p => p.ciclo_id === c_25_ii)?.id;

    if (!p_26_i) {
        await qi.bulkInsert('programaciones', [{
            id: '11111111-1111-1111-1111-111111111111',
            ciclo_id: c_26_i,
            nombre: 'Programación 2026-I Principal',
            fase: 1,
            estado: 'borrador',
            created_at: new Date(),
            updated_at: new Date()
        }]);
        p_26_i = '11111111-1111-1111-1111-111111111111';
    }

    if (!p_25_ii) {
        await qi.bulkInsert('programaciones', [{
            id: '22222222-2222-2222-2222-222222222222',
            ciclo_id: c_25_ii,
            nombre: 'Programación 2025-II Principal',
            fase: 1,
            estado: 'borrador',
            created_at: new Date(),
            updated_at: new Date()
        }]);
        p_25_ii = '22222222-2222-2222-2222-222222222222';
    }

    const cursos = (await qi.sequelize.query("SELECT id, codigo FROM cursos;"))[0];
    const getCursoId = (codigo) => cursos.find(c => c.codigo === codigo)?.id;

    const grupos = [
      { programacion_id: p_26_i, curso_id: getCursoId('IS-101'), numero_grupo: 1, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-102'), numero_grupo: 2, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-103'), numero_grupo: 3, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('PSI-101'), numero_grupo: 4, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('MAT-101'), numero_grupo: 5, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('LNL-101'), numero_grupo: 6, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('MAT-102'), numero_grupo: 7, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('EST-101'), numero_grupo: 8, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('EST-102'), numero_grupo: 9, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-301'), numero_grupo: 1, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-302'), numero_grupo: 2, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-303'), numero_grupo: 3, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('MAT-301'), numero_grupo: 4, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('EST-301'), numero_grupo: 5, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('ADM-301'), numero_grupo: 6, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('FIS-301'), numero_grupo: 7, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('PSI-301'), numero_grupo: 8, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-501'), numero_grupo: 1, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-502'), numero_grupo: 2, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-503'), numero_grupo: 3, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-504'), numero_grupo: 4, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-505'), numero_grupo: 5, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-506'), numero_grupo: 6, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IND-501'), numero_grupo: 7, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('CF-501'), numero_grupo: 8, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-701'), numero_grupo: 1, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-702'), numero_grupo: 2, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-703'), numero_grupo: 3, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-704'), numero_grupo: 4, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-705'), numero_grupo: 5, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-706'), numero_grupo: 6, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-707'), numero_grupo: 7, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IND-701'), numero_grupo: 8, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-703'), numero_grupo: 9, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IND-701'), numero_grupo: 10, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-901'), numero_grupo: 1, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-901'), numero_grupo: 2, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-902'), numero_grupo: 3, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-903'), numero_grupo: 4, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-904'), numero_grupo: 5, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-905'), numero_grupo: 6, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-906'), numero_grupo: 7, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-907'), numero_grupo: 8, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_26_i, curso_id: getCursoId('IS-908'), numero_grupo: 9, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-201'), numero_grupo: 1, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('SOC-201'), numero_grupo: 2, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('EDU-201'), numero_grupo: 3, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('FIL-201'), numero_grupo: 4, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('MAT-201'), numero_grupo: 5, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('FIS-201'), numero_grupo: 6, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('FIS-202'), numero_grupo: 7, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-401'), numero_grupo: 1, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-402'), numero_grupo: 2, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-403'), numero_grupo: 3, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-404'), numero_grupo: 4, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-405'), numero_grupo: 5, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-406'), numero_grupo: 6, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('FIS-401'), numero_grupo: 7, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('ECO-401'), numero_grupo: 8, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-601'), numero_grupo: 1, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-602'), numero_grupo: 2, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-603'), numero_grupo: 3, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-604'), numero_grupo: 4, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('CF-601'), numero_grupo: 5, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IND-601'), numero_grupo: 6, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('FIS-601'), numero_grupo: 7, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('AMB-601'), numero_grupo: 8, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-801'), numero_grupo: 1, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-802'), numero_grupo: 2, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-803'), numero_grupo: 3, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-804'), numero_grupo: 4, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-805'), numero_grupo: 5, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-806'), numero_grupo: 6, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('FIS-801'), numero_grupo: 7, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('DER-801'), numero_grupo: 8, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-1001'), numero_grupo: 1, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-1002'), numero_grupo: 2, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-1003'), numero_grupo: 3, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-1004'), numero_grupo: 4, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-1005'), numero_grupo: 5, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IS-1006'), numero_grupo: 6, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('FIS-1001'), numero_grupo: 7, max_alumnos: 30, num_alumnos: 25 },
      { programacion_id: p_25_ii, curso_id: getCursoId('IND-1001'), numero_grupo: 8, max_alumnos: 30, num_alumnos: 25 }
    ].filter(g => g.curso_id && g.programacion_id);

    await qi.bulkInsert('grupos', grupos, {});
  },
  down: async qi => qi.bulkDelete('grupos', null, {})
};