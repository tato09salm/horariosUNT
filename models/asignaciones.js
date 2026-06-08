const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return Asignaciones.init(sequelize, DataTypes);
}

class Asignaciones extends Sequelize.Model {
  static init(sequelize, DataTypes) {
  return super.init({
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ciclo_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'ciclos',
        key: 'id'
      }
    },
    grupo_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'grupos',
        key: 'id'
      }
    },
    docente_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'docentes',
        key: 'id'
      }
    },
    ambiente_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'ambientes',
        key: 'id'
      }
    },
    slot_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'slots_tiempo',
        key: 'id'
      }
    },
    dia: {
      type: DataTypes.ENUM("lunes","martes","miercoles","jueves","viernes","sabado"),
      allowNull: false
    },
    tipo: {
      type: DataTypes.ENUM("teoria","practica","laboratorio"),
      allowNull: false,
      defaultValue: "teoria"
    },
    estado: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "activo"
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'usuarios',
        key: 'id'
      }
    }
  }, {
    sequelize,
    tableName: 'asignaciones',
    schema: 'public',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: "asignaciones_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "idx_asig_ambiente_dia_slot",
        unique: true,
        fields: [
          { name: "ambiente_id" },
          { name: "dia" },
          { name: "slot_id" },
          { name: "ciclo_id" },
        ]
      },
      {
        name: "idx_asig_docente_dia_slot",
        unique: true,
        fields: [
          { name: "docente_id" },
          { name: "dia" },
          { name: "slot_id" },
          { name: "ciclo_id" },
        ]
      },
      {
        name: "idx_asig_grupo_dia_slot",
        unique: true,
        fields: [
          { name: "grupo_id" },
          { name: "dia" },
          { name: "slot_id" },
          { name: "ciclo_id" },
        ]
      },
    ]
  });
  }
}
