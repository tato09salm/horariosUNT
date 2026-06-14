const {Pool}=require('pg');
const p=new Pool({host:'localhost',port:5432,database:'horariosUNT',user:'postgres',password:'12345'});
(async()=>{
const r=await p.query("SELECT pc.*,c.codigo,d.nombre as doc_nombre,d.apellidos as doc_apellidos,g.tipo_actividad,g.numero_grupo FROM programacion_cursos pc JOIN grupos g ON pc.grupo_id=g.id JOIN cursos c ON pc.curso_id=c.id JOIN docentes d ON pc.docente_id=d.id WHERE g.programacion_id='ada7e99e-9829-465c-80e0-6426886891ea' AND c.codigo='EE-102' ORDER BY g.tipo_actividad,g.numero_grupo");
console.table(r.rows);
await p.end()})().catch(e=>{console.error(e.message);p.end()})
