const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return Cursos.init(sequelize, DataTypes);
}

class Cursos extends Sequelize.Model {
  static init(sequelize, DataTypes) {
  return super.init({
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    escuela_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'escuelas',
        key: 'id'
      }
    },
    codigo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: "cursos_codigo_key"
    },
    nombre: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    creditos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3
    },
    horas_teoria: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3
    },
    horas_practica: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    horas_laboratorio: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    bloque_indivisible: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    },
    cantidad_labs: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    ciclo_plan: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    semestre: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    prerequisitos: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: true
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    }
  }, {
    sequelize,
    tableName: 'cursos',
    schema: 'public',
    timestamps: true,
    indexes: [
      {
        name: "cursos_codigo_key",
        unique: true,
        fields: [
          { name: "codigo" },
        ]
      },
      {
        name: "cursos_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
    ]
  });
  }
}
