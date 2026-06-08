/* eslint-disable @typescript-eslint/no-require-imports */
const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return Rol.init(sequelize, DataTypes);
}

class Rol extends Sequelize.Model {
  static init(sequelize, DataTypes) {
  return super.init({
    codigo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: "roles_nombre_key"
    }
  }, {
    sequelize,
    tableName: 'roles',
    schema: 'public',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: "roles_nombre_key",
        unique: true,
        fields: [
          { name: "nombre" },
        ]
      },
      {
        name: "roles_pkey",
        unique: true,
        fields: [
          { name: "codigo" },
        ]
      },
    ]
  });
  }
}
