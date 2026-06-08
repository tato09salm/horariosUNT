const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return DisponibilidadDocente.init(sequelize, DataTypes);
}

class DisponibilidadDocente extends Sequelize.Model {
  static init(sequelize, DataTypes) {
  return super.init({
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    programacion_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'programaciones',
        key: 'id'
      },
      unique: "disponibilidad_docente_programacion_id_docente_id_slot_id_dia_u"
    },
    docente_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'docentes',
        key: 'id'
      },
      unique: "disponibilidad_docente_programacion_id_docente_id_slot_id_dia_u"
    },
    slot_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'slots_tiempo',
        key: 'id'
      },
      unique: "disponibilidad_docente_programacion_id_docente_id_slot_id_dia_u"
    },
    dia: {
      type: DataTypes.ENUM("lunes","martes","miercoles","jueves","viernes","sabado"),
      allowNull: false,
      unique: "disponibilidad_docente_programacion_id_docente_id_slot_id_dia_u"
    },
    disponible: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    },
    prioridad: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    registrado_por: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'usuarios',
        key: 'id'
      }
    }
  }, {
    sequelize,
    tableName: 'disponibilidad_docente',
    schema: 'public',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: "disponibilidad_docente_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "disponibilidad_docente_programacion_id_docente_id_slot_id_dia_u",
        unique: true,
        fields: [
          { name: "programacion_id" },
          { name: "docente_id" },
          { name: "slot_id" },
          { name: "dia" },
        ]
      },
      {
        name: "idx_disp_doc",
        fields: [
          { name: "docente_id" },
        ]
      },
      {
        name: "idx_disp_prog",
        fields: [
          { name: "programacion_id" },
        ]
      },
    ]
  });
  }
}
