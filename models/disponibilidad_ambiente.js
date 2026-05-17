const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return DisponibilidadAmbiente.init(sequelize, DataTypes);
}

class DisponibilidadAmbiente extends Sequelize.Model {
  static init(sequelize, DataTypes) {
  return super.init({
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ambiente_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'ambientes',
        key: 'id'
      },
      unique: "disponibilidad_ambiente_ambiente_id_slot_id_dia_uk"
    },
    slot_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'slots_tiempo',
        key: 'id'
      },
      unique: "disponibilidad_ambiente_ambiente_id_slot_id_dia_uk"
    },
    dia: {
      type: DataTypes.ENUM("lunes","martes","miercoles","jueves","viernes","sabado"),
      allowNull: false,
      unique: "disponibilidad_ambiente_ambiente_id_slot_id_dia_uk"
    },
    estado: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "disponible"
    },
    motivo: {
      type: DataTypes.STRING(200),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'disponibilidad_ambiente',
    schema: 'public',
    timestamps: true,
    indexes: [
      {
        name: "disponibilidad_ambiente_ambiente_id_slot_id_dia_uk",
        unique: true,
        fields: [
          { name: "ambiente_id" },
          { name: "slot_id" },
          { name: "dia" },
        ]
      },
      {
        name: "disponibilidad_ambiente_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "idx_disp_ambiente_dia",
        fields: [
          { name: "ambiente_id" },
          { name: "dia" },
        ]
      },
    ]
  });
  }
}
