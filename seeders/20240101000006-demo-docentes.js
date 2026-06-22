function makeCodigo(nombre, apellidos, dni) {
  const norm = (s) => (s || '').trim().replace(/\s+/g, '_').toUpperCase();
  return norm(apellidos) + '_' + norm(nombre) + '_' + dni;
}

const DOCENTES = [
  { nombre: 'Marcelino', apellidos: 'Torres Villanueva', dni: '11111111', telefono: '920611224', email: 'mtorres@unt.edu.pe', categoria: 'principal', condicion: 'nombrado', fecha_ingreso: '2000-03-01', grado_academico: 'doctor', horas_max_semana: 20 },
  { nombre: 'Bertha', apellidos: 'Urtecho Zavaleta', dni: '44444444',telefono: '920611224', email: 'burtecho@unt.edu.pe', categoria: 'principal', condicion: 'nombrado', fecha_ingreso: '1998-03-01', grado_academico: 'doctor', horas_max_semana: 20 },
  { nombre: 'Jose Luis', apellidos: 'Ponte Bejarano', dni: '55555555',telefono: '920611224', email: 'jponte@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2010-03-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Jorge Luis', apellidos: 'Rios Gonzales', dni: '66666666',telefono: '920611224', email: 'jrios@unt.edu.pe', categoria: 'auxiliar', condicion: 'contratado', fecha_ingreso: '2015-08-01', grado_academico: 'licenciado', horas_max_semana: 16 },
  { nombre: 'Segundo', apellidos: 'Guibar Obeso', dni: '77777777',telefono: '920611224', email: 'sguibar@unt.edu.pe', categoria: 'principal', condicion: 'nombrado', fecha_ingreso: '2002-03-01', grado_academico: 'doctor', horas_max_semana: 20 },
  { nombre: 'Miquel', apellidos: 'Ipanaque Zapata', dni: '88888888',telefono: '920611224', email: 'mipanaque@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2008-03-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Martha', apellidos: 'Cardoso', dni: '99999999',telefono: '920611224', email: 'mcardoso@unt.edu.pe', categoria: 'auxiliar', condicion: 'contratado', fecha_ingreso: '2020-08-01', grado_academico: 'bachiller', horas_max_semana: 16 },
  { nombre: 'Marcos', apellidos: 'Ferrer Reyna', dni: '23232323',telefono: '920611224', email: 'mferrer@unt.edu.pe', categoria: 'principal', condicion: 'nombrado', fecha_ingreso: '1999-03-01', grado_academico: 'doctor', horas_max_semana: 20 },
  { nombre: 'Teresita', apellidos: 'Rojas García', dni: '24242424',telefono: '920611224', email: 'trojas@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2011-03-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Juan', apellidos: 'Carrascal Cabanillas', dni: '25252525',telefono: '920611224', email: 'jcarrascal@unt.edu.pe', categoria: 'auxiliar', condicion: 'contratado', fecha_ingreso: '2016-08-01', grado_academico: 'licenciado', horas_max_semana: 16 },
  { nombre: 'Vilma Julia', apellidos: 'Mendez Gil', dni: '26262626',telefono: '920611224', email: 'wmendez@unt.edu.pe', categoria: 'principal', condicion: 'nombrado', fecha_ingreso: '2003-03-01', grado_academico: 'doctor', horas_max_semana: 20 },
  { nombre: 'Sheyla Laura', apellidos: 'Escobedo Rodriguez', dni: '27272727', telefono: '920611224', email: 'sescobedo@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2009-03-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Cesar', apellidos: 'Arellano Salazar', dni: '30303030', telefono: '920611224', email: 'carellano@unt.edu.pe', categoria: 'principal', condicion: 'nombrado', fecha_ingreso: '2017-08-01', grado_academico: 'licenciado', horas_max_semana: 20 },
  { nombre: 'Marcos', apellidos: 'Baca Lopez', dni: '32323232', telefono: '920611224', email: 'mbaca@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2013-03-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Ana', apellidos: 'Cuadra Mituzgaray', dni: '33333334', telefono: '920611224', email: 'acuadra@unt.edu.pe', categoria: 'auxiliar', condicion: 'contratado', fecha_ingreso: '2019-08-01', grado_academico: 'licenciado', horas_max_semana: 16 },
  { nombre: 'Zoraida', apellidos: 'Vidal Melgarejo', dni: '20202020', telefono: '920611224', email: 'zvidal@unt.edu.pe', categoria: 'principal', condicion: 'nombrado', fecha_ingreso: '2001-03-01', grado_academico: 'doctor', horas_max_semana: 20 },
  { nombre: 'Everson David', apellidos: 'Agreda Gamboa', dni: '21212121',telefono: '920611224', email: 'eagreda@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2006-08-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Robert Jerry', apellidos: 'Sánchez Ticona', dni: '29292929', email: 'rsanchez@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2012-03-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Alberto', apellidos: 'Mendoza de los Santos', dni: '22222222', telefono: '920611224', email: 'amendoza@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2005-08-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Juan Carlos', apellidos: 'Obando Roldán', dni: '22222223', telefono: '920611224', email: 'jobando@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2019-03-01', grado_academico: 'licenciado', horas_max_semana: 20 },
  { nombre: 'Luis', apellidos: 'Boy Chavil', dni: '28282828', telefono: '920611224', email: 'lboy@unt.edu.pe', categoria: 'principal', condicion: 'nombrado', fecha_ingreso: '2004-03-01', grado_academico: 'doctor', horas_max_semana: 20 },
  { nombre: 'Paul', apellidos: 'Cotrina Castellanos', dni: '33333333', email: 'pcotrina@unt.edu.pe', categoria: 'auxiliar', condicion: 'contratado', fecha_ingreso: '2018-03-01', grado_academico: 'licenciado', horas_max_semana: 16 },
  { nombre: 'Juan Pedro', apellidos: 'Santos Fernández', dni: '34343434', email: 'jsantos@unt.edu.pe', categoria: 'principal', condicion: 'nombrado', fecha_ingreso: '2005-03-01', grado_academico: 'doctor', horas_max_semana: 20 },
  { nombre: 'Ricardo', apellidos: 'Mendoza Rivera', dni: '35353535', email: 'rmendoza@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2010-03-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Oscar Romel', apellidos: 'Alcántara Moreno', dni: '36363636', email: 'oalcantara@unt.edu.pe', categoria: 'principal', condicion: 'nombrado', fecha_ingreso: '2018-08-01', grado_academico: 'licenciado', horas_max_semana: 20 },
  { nombre: 'Jhoe Alexis', apellidos: 'Gonzalez Vasquez', dni: '37373737', email: 'jgonzalez@unt.edu.pe', categoria: 'principal', condicion: 'nombrado', fecha_ingreso: '2008-03-01', grado_academico: 'doctor', horas_max_semana: 20 },
  { nombre: 'José', apellidos: 'Gómez Ávila', dni: '38383838', email: 'jgomez@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2011-03-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Edgard', apellidos: 'Pelaez Vinces', dni: '40404040', email: 'epelaez@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2007-03-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Diego', apellidos: 'Llaro Cruz', dni: '41414141', email: 'dllaro@unt.edu.pe', categoria: 'auxiliar', condicion: 'contratado', fecha_ingreso: '2018-08-01', grado_academico: 'licenciado', horas_max_semana: 16 },
  { nombre: 'Alex', apellidos: 'Herradas', dni: '42424242', email: 'aherradas@unt.edu.pe', categoria: 'principal', condicion: 'nombrado', fecha_ingreso: '2003-03-01', grado_academico: 'doctor', horas_max_semana: 20 },
  { nombre: 'Milton', apellidos: 'Cortez', dni: '43434343', email: 'mcortez@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2010-03-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Arístides', apellidos: 'Tavara Aponte', dni: '44444445', email: 'atavara@unt.edu.pe', categoria: 'auxiliar', condicion: 'contratado', fecha_ingreso: '2016-08-01', grado_academico: 'licenciado', horas_max_semana: 16 },
  { nombre: 'Segundo Roseli', apellidos: 'Jauregui Rosas', dni: '45454545', email: 'sjauregui@unt.edu.pe', categoria: 'principal', condicion: 'nombrado', fecha_ingreso: '2005-03-01', grado_academico: 'doctor', horas_max_semana: 20 },
  { nombre: 'Alberto', apellidos: 'Asmat Alva', dni: '52525252', email: 'aasmat@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2013-03-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Juan Manuel', apellidos: 'Granda Fernández', dni: '54545454', email: 'jgranda@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2014-03-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Luis', apellidos: 'Moncada Albites', dni: '57575757', email: 'lmoncada@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2015-03-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Camilo', apellidos: 'Suárez Rebaza', dni: '31313131', email: 'csuarez@unt.edu.pe', categoria: 'principal', condicion: 'nombrado', fecha_ingreso: '2007-03-01', grado_academico: 'doctor', horas_max_semana: 20 },
  { nombre: 'Marco Celi', apellidos: 'Arevalo', dni: '62626262', email: 'marevalo@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2012-03-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Carlos', apellidos: 'Rojas Taller', dni: '70707070', telefono: '920611225', email: 'crojas@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2014-03-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Maria', apellidos: 'López Taller', dni: '70808080', telefono: '920611226', email: 'mlopez@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2015-03-01', grado_academico: 'magister', horas_max_semana: 20 },
  { nombre: 'Pedro', apellidos: 'García Taller', dni: '70909090', telefono: '920611227', email: 'pgarcia@unt.edu.pe', categoria: 'asociado', condicion: 'nombrado', fecha_ingreso: '2016-03-01', grado_academico: 'magister', horas_max_semana: 20 },
];

module.exports = {
  up: async (qi) => {
    const prevEmailsDisabled = process.env.EMAILS_DISABLED;
    process.env.EMAILS_DISABLED = 'true';
    try {
      await qi.bulkInsert('docentes', DOCENTES.map(d => ({
        ...d,
        codigo: makeCodigo(d.nombre, d.apellidos, d.dni),
        es_escuela_configurada: true,
      })), {});
    } finally {
      process.env.EMAILS_DISABLED = prevEmailsDisabled;
    }
  },
  down: async qi => qi.bulkDelete('docentes', null, {})
};