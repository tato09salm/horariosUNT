const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return ProgramacionCursos.init(sequelize, DataTypes);
}

class ProgramacionCursos extends Sequelize.Model {
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
    curso_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'cursos',
        key: 'id'
      }
    },
    grupo_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'grupos',
        key: 'id'
      }
    },
    docente_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'docentes',
        key: 'id'
      }
    },
    horas_teoria: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
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
    horas_consejeria: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    seccion: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    notas: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'programacion_cursos',
    schema: 'public',
    timestamps: true,
    indexes: [
      {
        name: "idx_pc_prog",
        fields: [
          { name: "programacion_id" },
        ]
      },
      {
        name: "programacion_cursos_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "programacion_cursos_prog_grupo_docente_uk",
        unique: true,
        fields: [
          { name: "programacion_id" },
          { name: "grupo_id" },
          { name: "docente_id" },
        ]
      },
    ]
  });
  }
}
