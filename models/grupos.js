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
      unique: "grupos_prog_curso_act_num_uk"
    },
    curso_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'cursos',
        key: 'id'
      },
      unique: "grupos_prog_curso_act_num_uk"
    },
    tipo_actividad: {
      type: DataTypes.ENUM('teoria', 'practica', 'laboratorio'),
      allowNull: false,
      defaultValue: 'teoria',
      unique: "grupos_prog_curso_act_num_uk"
    },
    numero_grupo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      unique: "grupos_prog_curso_act_num_uk"
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
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        name: "grupos_prog_curso_act_num_uk",
        unique: true,
        fields: [
          { name: "programacion_id" },
          { name: "curso_id" },
          { name: "tipo_actividad" },
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
