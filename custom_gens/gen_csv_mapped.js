/*
const fs = require('fs'); const {Pool} = require('pg'); const p = new Pool({user:'postgres',password:'12345',host:'localhost',database:'horariosUNT'}); const mappings = [
  ['Zoraida Yanet Vidal Melgarejo', 'Programaci�n Orientada a Objetos I'],
  ['Edgard Pelaez Vinces', 'Sociedad, Cultura y Ecolog�a'],
  ['Diego Ularo Cruz', 'Cultura Investigativa y Pensamiento Cr�tico'],
  ['�lex Herradas', '�tica, Convivencia Humana y Ciudadan�a'],
  ['Milt�n Cortez', 'Trabajo de Investigaci�n - Secci�n B'],
  ['Aristeres Tavara Aponte', 'F�sica General'],
  ['Segundo Roseli Jauregui Rosas', 'F�sica General'],
  ['Juan Carlos Obando Rold�n', 'Dise�o Web'],
  ['Robert Jerry Sanchez Ticona', 'Computaci�n Gr�fica y Visual (e)'],
  ['C�sar Arellano Salazar', 'Sistemas Digitales'],
  ['Marcelino Torres Villanueva', 'Estructura de Datos Orientado a Objetos'],
  ['Camilo Su�rez Rebaza', 'Trabajo de Investigaci�n - Secci�n B'],
  ['Camilo Su�rez Rebaza', 'Plataformas Tecnol�gicas (e)'],
  ['Jos� Alberto G�mez �vila', 'Pensamiento de dise�o'],
  ['Alberto Asmat Alva', 'Econom�a General'],
  ['Robert Jerry S�nchez Ticona', 'Ingenier�a de Requerimientos'],
  ['C�sar Arellano Salazar', 'Sistemas Operativos'],
  ['Luis Enrique Boy Chavil', 'Ingenier�a de Datos II'],
  ['Marcelino Torres Villanueva', 'Sistemas Inteligentes'],
  ['Juan Manuel Granda Fern�ndez', 'Trabajo de Investigaci�n - Secci�n B'],
  ['Joe Alexis Gonzalez Vasquez', 'Ingenier�a Econ�mica'],
  ['Juan Cabanillas', 'Gesti�n del Talento Humano (e)'],
  ['Luis Moncada Albitres', 'Ingenier�a Ambiental (e)'],
  ['Juan Carlos Obando Rold�n', 'Arquitectura basada en Microservicios (e)'],
  ['Juan Pedro Santos Fern�ndez', 'Ingenier�a de Software II'],
  ['Everson David Agreda Gamboa', 'Redes y Comunicaciones II'],
  ['Alberto Carlos Mendoza de los Santos', 'Seguridad de la Informaci�n'],
  ['Ricardo Dar�o Mendoza Rivera', 'Trabajo de Investigaci�n - Secci�n B'],
  ['Jos� Alberto G�mez Avila', 'Internet de las Cosas'],
  ['Oscar Romel Alcantara Moreno', 'Marketing y Medios Sociales'],
  ['Marco Geli Arevalo', 'Deontolog�a y Derecho Inform�tico (e)'],
  ['Everson David Agreda Gamboa', 'Arquitectura Empresarial'],
  ['Robert Jerry Sanchez Ticona', 'Aplicaciones M�viles'],
  ['Juan Pedro Santos Fernandez', 'Trabajo de Investigaci�n - Secci�n A'],
  ['Alberto Carlos Mendoza de los Santos', 'Gobierno de TIC'],
  ['Ricardo Dar�o Mendoza Rivera', 'Trabajo de Investigaci�n - Secci�n B'],
  ['Oscar Romel Alcantara Moreno', 'Pr�cticas Pre Profesionales'],
  ['Jorge Paul Cotrina Castellanos', 'Sistemas de Informaci�n Empresarial'],
  ['Joe Alexis Gonzalez Vasquez', 'Responsabilidad Social Corporativa'],
  ['Marcelino Torres Villanueva', 'Introducci�n a la Programaci�n'],
  ['Alberto Mendoza de los Santos', 'Introducci�n a la Ing. de Sistemas'],
  ['Paul Cotrina Castellanos', 'Introducci�n a la Programaci�n'],
  ['Bertha Urtecho Zavaleta', 'Desarrollo Personal'],
  ['Jose Luis Ponte Bejarano', 'Desarrollo del Pens. L�gico Matem.'],
  ['Jorge Luis Rios Gonzales', 'Lectura Cr�tica y Redac. Textos Acad.'],
  ['Segundo Guibar Obeso', 'Introducci�n al An�lisis Matem�tico'],
  ['Miguel Ipanaque Zapata', 'Estad�stica General'],
  ['Martha Cardoso', 'Estad�stica General'],
  ['Zoraida Vidal Melgarejo', 'Programaci�n Orientada a Objetos II'],
  ['Everson David Agreda Gamboa', 'Sist�mica'],
  ['Juan Carlos Obando Rold�n', 'Ingenier�a Gr�fica (e)'],
  ['Marcos Ferrer Reyna', 'Matem�tica Aplicada'],
  ['Teresita Rojas Garcia', 'Estad�stica Aplicada'],
  ['Juan Carrascal Cabanillas', 'Administraci�n General'],
  ['Vilma Mendez Gil', 'F�sica Electr�nica'],
  ['Sheyla Laura Escobedo Rodriguez', 'Psicolog�a Organizacional (e)'],
  ['Luis Boy Chavil', 'Ingenier�a de Datos I'],
  ['Juan Carlos Obando Roldan', 'Sistemas de Informaci�n'],
  ['Everson David Agreda Gamboa', 'Transformaci�n digital'],
  ['Robert Jerry S�nchez Ticona', 'Tecnolog�a web'],
  ['Cesar Arellano Salazar', 'Arquitectura de computadoras'],
  ['Camilo Su�rez Rebaza', 'Teleinform�tica (e)'],
  ['Marcos Baca Lopez', 'Investigaci�n de Operaciones'],
  ['Ana Cuadra Mitzugaray', 'Contabilidad Gerencial'],
  ['Juan Pedro Santos Fern�ndez', 'Ingenier�a de Software I'],
  ['C�sar Arellano Salazar', 'Redes y Comunicaciones I'],
  ['Robert Jerry S�nchez Ticona', 'Ingenier�a de Software I'],
  ['Everson David Agreda Gamboa', 'Negocios Electr�nicos (e)'],
  ['Alberto Mendoza de los Santos', 'Gesti�n de Servicios de TI'],
  ['Paul Cotrina Catellanos', 'Metodolog�a de la Investigaci�n Cient�fica'],
  ['Ricardo Mendoza Rivera', 'Administraci�n de Base de Datos'],
  ['Oscar Romel Alc�ntara Moreno', 'Planeamiento Estrat�gico de TI'],
  ['Paul Cotrina Castellanos', 'Negocios Electr�nicos (e)'],
  ['Jhoe Gonzalez Vasquez', 'Cadena de Suministros (e)'],
  ['Juan Pedro Santos Fern�ndez', 'Tesis I'],
  ['Ricardo Mendoza Rivera', 'Tesis I'],
  ['Ricardo Mendoza Rivera', 'Anal�tica de Negocios'],
  ['Alberto Mendoza de los Santos', 'Auditor�a Inform�tica'],
  ['Jos� G�mez �vila', 'Gesti�n de Proyectos de TI'],
  ['Oscar Romel Alc�ntara Moreno', 'Emprendimiento Tecnol�gico'],
  ['Marcelino Torres Villanueva', 'Ingenier�a Web'],
  ['Jos� G�mez �vila', 'Computaci�n en la Nube'],
  ['Camilo Suarez Rebaza', 'Hackeo �tico (e)']
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
*/