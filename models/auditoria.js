const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return Auditoria.init(sequelize, DataTypes);
}

class Auditoria extends Sequelize.Model {
  static init(sequelize, DataTypes) {
  return super.init({
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    usuario_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'usuarios',
        key: 'id'
      }
    },
    usuario_nombre: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    usuario_email: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    accion: {
      type: DataTypes.ENUM("CREATE","UPDATE","DELETE","LOGIN","LOGOUT","GENERATE_SCHEDULE","EXPORT_REPORT","ASSIGN","UNASSIGN"),
      allowNull: false
    },
    tabla_afectada: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    registro_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    datos_anteriores: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    datos_nuevos: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'auditoria',
    schema: 'public',
    timestamps: true,
    indexes: [
      {
        name: "auditoria_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "idx_auditoria_accion",
        fields: [
          { name: "accion" },
        ]
      },
      {
        name: "idx_auditoria_fecha",
        fields: [
          { name: "created_at" },
        ]
      },
      {
        name: "idx_auditoria_tabla",
        fields: [
          { name: "tabla_afectada" },
        ]
      },
      {
        name: "idx_auditoria_usuario",
        fields: [
          { name: "usuario_id" },
        ]
      },
    ]
  });
  }
}
