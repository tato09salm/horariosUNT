const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return SlotsTiempo.init(sequelize, DataTypes);
}

class SlotsTiempo extends Sequelize.Model {
  static init(sequelize, DataTypes) {
  return super.init({
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    hora_inicio: {
      type: DataTypes.TIME,
      allowNull: false,
      unique: "slots_tiempo_hora_inicio_hora_fin_uk"
    },
    hora_fin: {
      type: DataTypes.TIME,
      allowNull: false,
      unique: "slots_tiempo_hora_inicio_hora_fin_uk"
    },
    orden: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'slots_tiempo',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "slots_tiempo_hora_inicio_hora_fin_uk",
        unique: true,
        fields: [
          { name: "hora_inicio" },
          { name: "hora_fin" },
        ]
      },
      {
        name: "slots_tiempo_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
    ]
  });
  }
}
