const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return Curriculas.init(sequelize, DataTypes);
}

class Curriculas extends Sequelize.Model {
  static init(sequelize, DataTypes) {
  return super.init({
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    nombre_carrera: {
      type: DataTypes.STRING,
      allowNull: false
    },
    año_curricula: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    modalidad_estudios: {
      type: DataTypes.STRING,
      allowNull: false
    },
    creditos_totales: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'curriculas',
    schema: 'public',
    timestamps: true,
    indexes: [
      {
        name: "curriculas_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
    ]
  });
  }
}
