const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return MallaCurricular.init(sequelize, DataTypes);
}

class MallaCurricular extends Sequelize.Model {
  static init(sequelize, DataTypes) {
  return super.init({
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    curricula_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'curriculas',
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
    }
  }, {
    sequelize,
    tableName: 'malla_curricular',
    schema: 'public',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
      {
        name: "malla_curricular_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "unique_curso_por_curricula",
        unique: true,
        fields: [
          { name: "curricula_id" },
          { name: "curso_id" }
        ]
      }
    ]
  });
  }
}
