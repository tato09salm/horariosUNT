const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return Grupos.init(sequelize, DataTypes);
}

class Grupos extends Sequelize.Model {
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
      },
      unique: "grupos_programacion_id_curso_id_numero_grupo_uk"
    },
    curso_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'cursos',
        key: 'id'
      },
      unique: "grupos_programacion_id_curso_id_numero_grupo_uk"
    },
    numero_grupo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      unique: "grupos_programacion_id_curso_id_numero_grupo_uk"
    },
    max_alumnos: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 30
    },
    num_alumnos: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    }
  }, {
    sequelize,
    tableName: 'grupos',
    schema: 'public',
    timestamps: true,
    indexes: [
      {
        name: "grupos_programacion_id_curso_id_numero_grupo_uk",
        unique: true,
        fields: [
          { name: "programacion_id" },
          { name: "curso_id" },
          { name: "numero_grupo" },
        ]
      },
      {
        name: "grupos_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
    ]
  });
  }
}
