const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return ConflictosHorario.init(sequelize, DataTypes);
}

class ConflictosHorario extends Sequelize.Model {
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
      }
    },
    tipo: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    severidad: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "error"
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    datos: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    sugerencia: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    resuelto: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    }
  }, {
    sequelize,
    tableName: 'conflictos_horario',
    schema: 'public',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        name: "conflictos_horario_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "idx_conf_prog",
        fields: [
          { name: "programacion_id" },
        ]
      },
    ]
  });
  }
}
