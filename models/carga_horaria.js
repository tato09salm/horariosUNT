'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CargaHoraria extends Model {
    static associate(models) {
      CargaHoraria.belongsTo(models.Docentes, {
        foreignKey: 'docente_id',
        as: 'docente'
      });
      CargaHoraria.belongsTo(models.Ciclos, {
        foreignKey: 'ciclo_academico_id',
        as: 'cicloAcademico'
      });
      CargaHoraria.hasMany(models.CargaHorariaCursos, {
        foreignKey: 'carga_horaria_id',
        as: 'cursos',
        onDelete: 'CASCADE'
      });
      CargaHoraria.hasOne(models.CargaHorariaPreparacion, {
        foreignKey: 'carga_horaria_id',
        as: 'preparacion',
        onDelete: 'CASCADE'
      });
      CargaHoraria.hasOne(models.CargaHorariaConsejeria, {
        foreignKey: 'carga_horaria_id',
        as: 'consejeria',
        onDelete: 'CASCADE'
      });
      CargaHoraria.hasOne(models.CargaHorariaInvestigacion, {
        foreignKey: 'carga_horaria_id',
        as: 'investigacion',
        onDelete: 'CASCADE'
      });
      CargaHoraria.hasOne(models.CargaHorariaCapacitacion, {
        foreignKey: 'carga_horaria_id',
        as: 'capacitacion',
        onDelete: 'CASCADE'
      });
      CargaHoraria.hasOne(models.CargaHorariaGobierno, {
        foreignKey: 'carga_horaria_id',
        as: 'gobierno',
        onDelete: 'CASCADE'
      });
      CargaHoraria.hasOne(models.CargaHorariaAdministracion, {
        foreignKey: 'carga_horaria_id',
        as: 'administracion',
        onDelete: 'CASCADE'
      });
      CargaHoraria.hasOne(models.CargaHorariaAsesoria, {
        foreignKey: 'carga_horaria_id',
        as: 'asesoria',
        onDelete: 'CASCADE'
      });
      CargaHoraria.hasOne(models.CargaHorariaRsu, {
        foreignKey: 'carga_horaria_id',
        as: 'rsu',
        onDelete: 'CASCADE'
      });
      CargaHoraria.hasOne(models.CargaHorariaComites, {
        foreignKey: 'carga_horaria_id',
        as: 'comites',
        onDelete: 'CASCADE'
      });
    }
  }
  CargaHoraria.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.literal('uuid_generate_v4()'),
      primaryKey: true
    },
    docente_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    ciclo_academico_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    ciclo_plan: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    modalidad: {
      type: DataTypes.STRING,
      allowNull: true
    },
    facultad: {
      type: DataTypes.STRING,
      allowNull: true
    },
    dpto_academico: {
      type: DataTypes.STRING,
      allowNull: true
    },
    horas_asignadas: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    adicional: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.literal('NOW()')
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.literal('NOW()')
    }
  }, {
    sequelize,
    modelName: 'CargaHoraria',
    tableName: 'carga_horaria',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
  return CargaHoraria;
};
