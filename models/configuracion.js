const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return Configuracion.init(sequelize, DataTypes);
}

class Configuracion extends Sequelize.Model {
  static init(sequelize, DataTypes) {
  return super.init({
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    clave: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: "configuracion_clave_key"
    },
    valor: {
      type: Sequelize.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'configuracion',
    schema: 'public',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
      {
        name: "configuracion_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "configuracion_clave_key",
        unique: true,
        fields: [
          { name: "clave" },
        ]
      }
    ]
  });
  }
}
