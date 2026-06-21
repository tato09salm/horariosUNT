const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return Docentes.init(sequelize, DataTypes);
}

class Docentes extends Sequelize.Model {
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
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    apellidos: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    dni: {
      type: DataTypes.STRING(8),
      allowNull: false,
      unique: "docentes_dni_key"
    },
    email: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    telefono: {
      type: DataTypes.STRING(15),
      allowNull: true
    },
    categoria: {
      type: DataTypes.ENUM("principal","asociado","auxiliar","jefe_practica"),
      allowNull: false
    },
    condicion: {
      type: DataTypes.ENUM("nombrado","contratado"),
      allowNull: false
    },
    fecha_ingreso: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    grado_academico: {
      type: DataTypes.ENUM("bachiller","licenciado","magister","doctor"),
      allowNull: true
    },
    horas_max_semana: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 20
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    },
facultad: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    dpto_academico: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    es_escuela_configurada: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    sequelize,
    tableName: 'docentes',
    schema: 'public',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: "docentes_dni_key",
        unique: true,
        fields: [
          { name: "dni" },
        ]
      },
      {
        name: "docentes_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
    ]
  });
  }
}
