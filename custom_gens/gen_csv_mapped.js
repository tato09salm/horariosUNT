const fs = require('fs'); const {Pool} = require('pg'); const p = new Pool({user:'postgres',password:'12345',host:'localhost',database:'horariosUNT'}); const mappings = [
  ['Zoraida Yanet Vidal Melgarejo', 'Programación Orientada a Objetos I'],
  ['Edgard Pelaez Vinces', 'Sociedad, Cultura y Ecología'],
  ['Diego Ularo Cruz', 'Cultura Investigativa y Pensamiento Crítico'],
  ['Álex Herradas', 'Ética, Convivencia Humana y Ciudadanía'],
  ['Miltón Cortez', 'Trabajo de Investigación - Sección B'],
  ['Aristeres Tavara Aponte', 'Física General'],
  ['Segundo Roseli Jauregui Rosas', 'Física General'],
  ['Juan Carlos Obando Roldán', 'Diseño Web'],
  ['Robert Jerry Sanchez Ticona', 'Computación Gráfica y Visual (e)'],
  ['César Arellano Salazar', 'Sistemas Digitales'],
  ['Marcelino Torres Villanueva', 'Estructura de Datos Orientado a Objetos'],
  ['Camilo Suárez Rebaza', 'Trabajo de Investigación - Sección B'],
  ['Camilo Suárez Rebaza', 'Plataformas Tecnológicas (e)'],
  ['José Alberto Gómez Ávila', 'Pensamiento de diseño'],
  ['Alberto Asmat Alva', 'Economía General'],
  ['Robert Jerry Sánchez Ticona', 'Ingeniería de Requerimientos'],
  ['César Arellano Salazar', 'Sistemas Operativos'],
  ['Luis Enrique Boy Chavil', 'Ingeniería de Datos II'],
  ['Marcelino Torres Villanueva', 'Sistemas Inteligentes'],
  ['Juan Manuel Granda Fernández', 'Trabajo de Investigación - Sección B'],
  ['Joe Alexis Gonzalez Vasquez', 'Ingeniería Económica'],
  ['Juan Cabanillas', 'Gestión del Talento Humano (e)'],
  ['Luis Moncada Albitres', 'Ingeniería Ambiental (e)'],
  ['Juan Carlos Obando Roldán', 'Arquitectura basada en Microservicios (e)'],
  ['Juan Pedro Santos Fernández', 'Ingeniería de Software II'],
  ['Everson David Agreda Gamboa', 'Redes y Comunicaciones II'],
  ['Alberto Carlos Mendoza de los Santos', 'Seguridad de la Información'],
  ['Ricardo Darío Mendoza Rivera', 'Trabajo de Investigación - Sección B'],
  ['José Alberto Gómez Avila', 'Internet de las Cosas'],
  ['Oscar Romel Alcantara Moreno', 'Marketing y Medios Sociales'],
  ['Marco Geli Arevalo', 'Deontología y Derecho Informático (e)'],
  ['Everson David Agreda Gamboa', 'Arquitectura Empresarial'],
  ['Robert Jerry Sanchez Ticona', 'Aplicaciones Móviles'],
  ['Juan Pedro Santos Fernandez', 'Trabajo de Investigación - Sección A'],
  ['Alberto Carlos Mendoza de los Santos', 'Gobierno de TIC'],
  ['Ricardo Darío Mendoza Rivera', 'Trabajo de Investigación - Sección B'],
  ['Oscar Romel Alcantara Moreno', 'Prácticas Pre Profesionales'],
  ['Jorge Paul Cotrina Castellanos', 'Sistemas de Información Empresarial'],
  ['Joe Alexis Gonzalez Vasquez', 'Responsabilidad Social Corporativa'],
  ['Marcelino Torres Villanueva', 'Introducción a la Programación'],
  ['Alberto Mendoza de los Santos', 'Introducción a la Ing. de Sistemas'],
  ['Paul Cotrina Castellanos', 'Introducción a la Programación'],
  ['Bertha Urtecho Zavaleta', 'Desarrollo Personal'],
  ['Jose Luis Ponte Bejarano', 'Desarrollo del Pens. Lógico Matem.'],
  ['Jorge Luis Rios Gonzales', 'Lectura Crítica y Redac. Textos Acad.'],
  ['Segundo Guibar Obeso', 'Introducción al Análisis Matemático'],
  ['Miguel Ipanaque Zapata', 'Estadística General'],
  ['Martha Cardoso', 'Estadística General'],
  ['Zoraida Vidal Melgarejo', 'Programación Orientada a Objetos II'],
  ['Everson David Agreda Gamboa', 'Sistémica'],
  ['Juan Carlos Obando Roldán', 'Ingeniería Gráfica (e)'],
  ['Marcos Ferrer Reyna', 'Matemática Aplicada'],
  ['Teresita Rojas Garcia', 'Estadística Aplicada'],
  ['Juan Carrascal Cabanillas', 'Administración General'],
  ['Vilma Mendez Gil', 'Física Electrónica'],
  ['Sheyla Laura Escobedo Rodriguez', 'Psicología Organizacional (e)'],
  ['Luis Boy Chavil', 'Ingeniería de Datos I'],
  ['Juan Carlos Obando Roldan', 'Sistemas de Información'],
  ['Everson David Agreda Gamboa', 'Transformación digital'],
  ['Robert Jerry Sánchez Ticona', 'Tecnología web'],
  ['Cesar Arellano Salazar', 'Arquitectura de computadoras'],
  ['Camilo Suárez Rebaza', 'Teleinformática (e)'],
  ['Marcos Baca Lopez', 'Investigación de Operaciones'],
  ['Ana Cuadra Mitzugaray', 'Contabilidad Gerencial'],
  ['Juan Pedro Santos Fernández', 'Ingeniería de Software I'],
  ['César Arellano Salazar', 'Redes y Comunicaciones I'],
  ['Robert Jerry Sánchez Ticona', 'Ingeniería de Software I'],
  ['Everson David Agreda Gamboa', 'Negocios Electrónicos (e)'],
  ['Alberto Mendoza de los Santos', 'Gestión de Servicios de TI'],
  ['Paul Cotrina Catellanos', 'Metodología de la Investigación Científica'],
  ['Ricardo Mendoza Rivera', 'Administración de Base de Datos'],
  ['Oscar Romel Alcántara Moreno', 'Planeamiento Estratégico de TI'],
  ['Paul Cotrina Castellanos', 'Negocios Electrónicos (e)'],
  ['Jhoe Gonzalez Vasquez', 'Cadena de Suministros (e)'],
  ['Juan Pedro Santos Fernández', 'Tesis I'],
  ['Ricardo Mendoza Rivera', 'Tesis I'],
  ['Ricardo Mendoza Rivera', 'Analítica de Negocios'],
  ['Alberto Mendoza de los Santos', 'Auditoría Informática'],
  ['José Gómez Ávila', 'Gestión de Proyectos de TI'],
  ['Oscar Romel Alcántara Moreno', 'Emprendimiento Tecnológico'],
  ['Marcelino Torres Villanueva', 'Ingeniería Web'],
  ['José Gómez Ávila', 'Computación en la Nube'],
  ['Camilo Suarez Rebaza', 'Hackeo Ético (e)']
];
function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[^\w\s]/g, ''); }
async function generate() { 
  const cursos = await p.query('SELECT * FROM cursos WHERE activo = true'); 
  const docentes = await p.query('SELECT * FROM docentes WHERE activo = true'); 
  let csv2025 = 'CICLO,CODIGO,CURSO,GRUPO,DOCENTE,T,P,L,C\n'; 
  let csv2026 = 'CICLO,CODIGO,CURSO,GRUPO,DOCENTE,T,P,L,C\n'; 
  
  function getDocente(cursoNombre) { 
    const matches = mappings.filter(m => norm(m[1]).includes(norm(cursoNombre)) || norm(cursoNombre).includes(norm(m[1])));
    if (matches.length > 0) {
      const targetName = matches[Math.floor(Math.random() * matches.length)][0];
      const found = docentes.rows.find(d => norm(d.nombre+' '+d.apellidos).includes(norm(targetName)) || norm(targetName).includes(norm(d.nombre+' '+d.apellidos)) || norm(d.apellidos).includes(norm(targetName.split(' ').pop())));
      if (found) return found.dni;
    }
    return docentes.rows[Math.floor(Math.random() * docentes.rows.length)].dni; 
  } 
  
  const toRoman = (num) => ['I','II','III','IV','V','VI','VII','VIII','IX','X'][num - 1] || num.toString(); 
  
  for (const c of cursos.rows) { 
    const isEven = c.ciclo_plan % 2 === 0; 
    const cic = toRoman(c.ciclo_plan); 
    const row = cic+','+c.codigo+','+c.nombre.replace(/,/g, ''); 
    let rowsForThisCourse = ''; 
    if (c.horas_teoria > 0) { 
      rowsForThisCourse += row+',G1 (Teoria),'+getDocente(c.nombre)+','+c.horas_teoria+',0,0,0\n'; 
    } 
    if (c.horas_practica > 0) { 
      rowsForThisCourse += row+',G1 (Practica),'+getDocente(c.nombre)+',0,'+c.horas_practica+',0,0\n'; 
    } 
    if (c.horas_laboratorio > 0) { 
      const labs = c.cantidad_labs || 1; 
      for (let i=1; i<=labs; i++) { 
        rowsForThisCourse += row+',G'+i+' (Laboratorio),'+getDocente(c.nombre)+',0,0,'+c.horas_laboratorio+',0\n'; 
      } 
    } 
    if (isEven) { csv2025 += rowsForThisCourse; } else { csv2026 += rowsForThisCourse; } 
  } 
  fs.writeFileSync('C:/Users/USERJSSV/.gemini/antigravity/brain/8f7fc220-00fb-4086-9f3e-8bc1322e340e/carga_2025_II.csv', csv2025, 'utf8'); 
  fs.writeFileSync('C:/Users/USERJSSV/.gemini/antigravity/brain/8f7fc220-00fb-4086-9f3e-8bc1322e340e/carga_2026_I.csv', csv2026, 'utf8'); 
  p.end(); 
} 
generate();
