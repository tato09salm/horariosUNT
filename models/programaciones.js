const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return Programaciones.init(sequelize, DataTypes);
}

class Programaciones extends Sequelize.Model {
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
      allowNull: false,
      references: {
        model: 'ciclos',
        key: 'id'
      }
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    fase: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    estado: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "borrador"
    },
    config: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'usuarios',
        key: 'id'
      }
    },
    publicado_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    publicado_por: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'usuarios',
        key: 'id'
      }
    }
  }, {
    sequelize,
    tableName: 'programaciones',
    schema: 'public',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: "idx_prog_ciclo",
        fields: [
          { name: "ciclo_id" },
        ]
      },
      {
        name: "idx_prog_estado",
        fields: [
          { name: "estado" },
        ]
      },
      {
        name: "programaciones_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
    ]
  });
  }
}
