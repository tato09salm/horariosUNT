const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return Ciclos.init(sequelize, DataTypes);
}

class Ciclos extends Sequelize.Model {
  static init(sequelize, DataTypes) {
  return super.init({
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: "ciclos_nombre_key"
    },
    'año': {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    semestre: {
      type: DataTypes.STRING(3),
      allowNull: false
    },
    tipo: {
      type: DataTypes.ENUM('regular', 'extraordinario'),
      allowNull: false,
      defaultValue: 'regular'
    },
    fecha_inicio: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    fecha_fin: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    }
  }, {
    sequelize,
    tableName: 'ciclos',
    schema: 'public',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        name: "ciclos_nombre_key",
        unique: true,
        fields: [
          { name: "nombre" },
        ]
      },
      {
        name: "ciclos_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
    ]
  });
  }
}
