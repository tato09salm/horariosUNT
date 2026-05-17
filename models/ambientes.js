const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return Ambientes.init(sequelize, DataTypes);
}

class Ambientes extends Sequelize.Model {
  static init(sequelize, DataTypes) {
  return super.init({
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    codigo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: "ambientes_codigo_key"
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    tipo: {
      type: DataTypes.ENUM("aula","laboratorio","auditorio"),
      allowNull: false
    },
    capacidad: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30
    },
    piso: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    edificio: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    equipamiento: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: true
    },
    disponible: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    }
  }, {
    sequelize,
    tableName: 'ambientes',
    schema: 'public',
    timestamps: true,
    indexes: [
      {
        name: "ambientes_codigo_key",
        unique: true,
        fields: [
          { name: "codigo" },
        ]
      },
      {
        name: "ambientes_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
    ]
  });
  }
}
