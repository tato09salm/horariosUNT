const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return Escuelas.init(sequelize, DataTypes);
}

class Escuelas extends Sequelize.Model {
  static init(sequelize, DataTypes) {
  return super.init({
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: "escuelas_codigo_key"
    }
  }, {
    sequelize,
    tableName: 'escuelas',
    schema: 'public',
    timestamps: true,
    indexes: [
      {
        name: "escuelas_codigo_key",
        unique: true,
        fields: [
          { name: "codigo" },
        ]
      },
      {
        name: "escuelas_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
    ]
  });
  }
}
