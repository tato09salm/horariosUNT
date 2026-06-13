const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return CargaHorariaCursos.init(sequelize, DataTypes);
}

class CargaHorariaCursos extends Sequelize.Model {
  static init(sequelize, DataTypes) {
  return super.init({
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    carga_horaria_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'carga_horaria',
        key: 'id'
      }
    },
    curso_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'cursos',
        key: 'id'
      }
    },
    seccion: {
      type: DataTypes.STRING,
      allowNull: true
    },
    escuela: {
      type: DataTypes.STRING,
      allowNull: true
    },
    num_alumnos: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    hrs_teo: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    hrs_pra: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    hrs_lab: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    total_hrs: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    }
  }, {
    sequelize,
    tableName: 'carga_horaria_cursos',
    schema: 'public',
    timestamps: true,
    indexes: []
  });
  }
}
