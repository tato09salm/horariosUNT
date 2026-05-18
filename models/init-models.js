const DataTypes = require("sequelize").DataTypes;
const _SequelizeMeta = require("./SequelizeMeta");
const _Ambientes = require("./ambientes");
const _Asignaciones = require("./asignaciones");
const _Auditoria = require("./auditoria");
const _Ciclos = require("./ciclos");
const _ConflictosHorario = require("./conflictos_horario");
const _Cursos = require("./cursos");
const _DisponibilidadAmbiente = require("./disponibilidad_ambiente");
const _DisponibilidadDocente = require("./disponibilidad_docente");
const _Docentes = require("./docentes");
const _Escuelas = require("./escuelas");
const _Grupos = require("./grupos");
const _ProgramacionCursos = require("./programacion_cursos");
const _Programaciones = require("./programaciones");
const _SlotsTiempo = require("./slots_tiempo");
const _Usuarios = require("./usuarios");
const _Curriculas = require("./curriculas");
const _MallaCurricular = require("./malla_curricular");
const _Configuracion = require("./configuracion");

function initModels(sequelize) {
  const SequelizeMeta = _SequelizeMeta(sequelize, DataTypes);
  const Ambientes = _Ambientes(sequelize, DataTypes);
  const Asignaciones = _Asignaciones(sequelize, DataTypes);
  const Auditoria = _Auditoria(sequelize, DataTypes);
  const Ciclos = _Ciclos(sequelize, DataTypes);
  const ConflictosHorario = _ConflictosHorario(sequelize, DataTypes);
  const Cursos = _Cursos(sequelize, DataTypes);
  const DisponibilidadAmbiente = _DisponibilidadAmbiente(sequelize, DataTypes);
  const DisponibilidadDocente = _DisponibilidadDocente(sequelize, DataTypes);
  const Docentes = _Docentes(sequelize, DataTypes);
  const Escuelas = _Escuelas(sequelize, DataTypes);
  const Grupos = _Grupos(sequelize, DataTypes);
  const ProgramacionCursos = _ProgramacionCursos(sequelize, DataTypes);
  const Programaciones = _Programaciones(sequelize, DataTypes);
  const SlotsTiempo = _SlotsTiempo(sequelize, DataTypes);
  const Usuarios = _Usuarios(sequelize, DataTypes);
  const Curriculas = _Curriculas(sequelize, DataTypes);
  const MallaCurricular = _MallaCurricular(sequelize, DataTypes);
  const Configuracion = _Configuracion(sequelize, DataTypes);

  Asignaciones.belongsTo(Ambientes, { as: "ambiente", foreignKey: "ambiente_id"});
  Ambientes.hasMany(Asignaciones, { as: "asignaciones", foreignKey: "ambiente_id"});
  DisponibilidadAmbiente.belongsTo(Ambientes, { as: "ambiente", foreignKey: "ambiente_id"});
  Ambientes.hasMany(DisponibilidadAmbiente, { as: "disponibilidad_ambientes", foreignKey: "ambiente_id"});
  Asignaciones.belongsTo(Ciclos, { as: "ciclo", foreignKey: "ciclo_id"});
  Ciclos.hasMany(Asignaciones, { as: "asignaciones", foreignKey: "ciclo_id"});
  Grupos.belongsTo(Programaciones, { as: "programacion", foreignKey: "programacion_id"});
  Programaciones.hasMany(Grupos, { as: "grupos", foreignKey: "programacion_id"});
  Programaciones.belongsTo(Ciclos, { as: "ciclo", foreignKey: "ciclo_id"});
  Ciclos.hasMany(Programaciones, { as: "programaciones", foreignKey: "ciclo_id"});
  Grupos.belongsTo(Cursos, { as: "curso", foreignKey: "curso_id"});
  Cursos.hasMany(Grupos, { as: "grupos", foreignKey: "curso_id"});
  ProgramacionCursos.belongsTo(Cursos, { as: "curso", foreignKey: "curso_id"});
  Cursos.hasMany(ProgramacionCursos, { as: "programacion_cursos", foreignKey: "curso_id"});
  Asignaciones.belongsTo(Docentes, { as: "docente", foreignKey: "docente_id"});
  Docentes.hasMany(Asignaciones, { as: "asignaciones", foreignKey: "docente_id"});
  DisponibilidadDocente.belongsTo(Docentes, { as: "docente", foreignKey: "docente_id"});
  Docentes.hasMany(DisponibilidadDocente, { as: "disponibilidad_docentes", foreignKey: "docente_id"});
  ProgramacionCursos.belongsTo(Docentes, { as: "docente", foreignKey: "docente_id"});
  Docentes.hasMany(ProgramacionCursos, { as: "programacion_cursos", foreignKey: "docente_id"});
  Cursos.belongsTo(Escuelas, { as: "escuela", foreignKey: "escuela_id"});
  Escuelas.hasMany(Cursos, { as: "cursos", foreignKey: "escuela_id"});
  Asignaciones.belongsTo(Grupos, { as: "grupo", foreignKey: "grupo_id"});
  Grupos.hasMany(Asignaciones, { as: "asignaciones", foreignKey: "grupo_id"});
  ProgramacionCursos.belongsTo(Grupos, { as: "grupo", foreignKey: "grupo_id"});
  Grupos.hasMany(ProgramacionCursos, { as: "programacion_cursos", foreignKey: "grupo_id"});
  ConflictosHorario.belongsTo(Programaciones, { as: "programacion", foreignKey: "programacion_id"});
  Programaciones.hasMany(ConflictosHorario, { as: "conflictos_horarios", foreignKey: "programacion_id"});
  DisponibilidadDocente.belongsTo(Programaciones, { as: "programacion", foreignKey: "programacion_id"});
  Programaciones.hasMany(DisponibilidadDocente, { as: "disponibilidad_docentes", foreignKey: "programacion_id"});
  ProgramacionCursos.belongsTo(Programaciones, { as: "programacion", foreignKey: "programacion_id"});
  Programaciones.hasMany(ProgramacionCursos, { as: "programacion_cursos", foreignKey: "programacion_id"});
  Asignaciones.belongsTo(SlotsTiempo, { as: "slot", foreignKey: "slot_id"});
  SlotsTiempo.hasMany(Asignaciones, { as: "asignaciones", foreignKey: "slot_id"});
  DisponibilidadAmbiente.belongsTo(SlotsTiempo, { as: "slot", foreignKey: "slot_id"});
  SlotsTiempo.hasMany(DisponibilidadAmbiente, { as: "disponibilidad_ambientes", foreignKey: "slot_id"});
  DisponibilidadDocente.belongsTo(SlotsTiempo, { as: "slot", foreignKey: "slot_id"});
  SlotsTiempo.hasMany(DisponibilidadDocente, { as: "disponibilidad_docentes", foreignKey: "slot_id"});
  Asignaciones.belongsTo(Usuarios, { as: "created_by_usuario", foreignKey: "created_by"});
  Usuarios.hasMany(Asignaciones, { as: "asignaciones", foreignKey: "created_by"});
  Auditoria.belongsTo(Usuarios, { as: "usuario", foreignKey: "usuario_id"});
  Usuarios.hasMany(Auditoria, { as: "auditoria", foreignKey: "usuario_id"});
  DisponibilidadDocente.belongsTo(Usuarios, { as: "registrado_por_usuario", foreignKey: "registrado_por"});
  Usuarios.hasMany(DisponibilidadDocente, { as: "disponibilidad_docentes", foreignKey: "registrado_por"});
  Docentes.belongsTo(Usuarios, { as: "usuario", foreignKey: "usuario_id"});
  Usuarios.hasMany(Docentes, { as: "docentes", foreignKey: "usuario_id"});
  Programaciones.belongsTo(Usuarios, { as: "created_by_usuario", foreignKey: "created_by"});
  Usuarios.hasMany(Programaciones, { as: "programaciones", foreignKey: "created_by"});
  Programaciones.belongsTo(Usuarios, { as: "publicado_por_usuario", foreignKey: "publicado_por"});
  Usuarios.hasMany(Programaciones, { as: "publicado_por_programaciones", foreignKey: "publicado_por"});

  Curriculas.belongsToMany(Cursos, { as: 'cursos', through: MallaCurricular, foreignKey: "curricula_id", otherKey: "curso_id" });
  Cursos.belongsToMany(Curriculas, { as: 'curriculas', through: MallaCurricular, foreignKey: "curso_id", otherKey: "curricula_id" });
  MallaCurricular.belongsTo(Curriculas, { as: "curricula", foreignKey: "curricula_id"});
  Curriculas.hasMany(MallaCurricular, { as: "mallas", foreignKey: "curricula_id"});
  MallaCurricular.belongsTo(Cursos, { as: "curso", foreignKey: "curso_id"});
  Cursos.hasMany(MallaCurricular, { as: "mallas", foreignKey: "curso_id"});

  return {
    SequelizeMeta,
    Ambientes,
    Asignaciones,
    Auditoria,
    Ciclos,
    ConflictosHorario,
    Cursos,
    DisponibilidadAmbiente,
    DisponibilidadDocente,
    Docentes,
    Escuelas,
    Grupos,
    ProgramacionCursos,
    Programaciones,
    SlotsTiempo,
    Usuarios,
    Curriculas,
    MallaCurricular,
    Configuracion,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
