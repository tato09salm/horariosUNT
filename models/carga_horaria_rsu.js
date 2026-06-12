const Sequelize = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  return CargaHorariaRSU.init(sequelize, DataTypes);
}

class CargaHorariaRSU extends Sequelize.Model {
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
    horas: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    plan: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'carga_horaria_rsu',
    schema: 'public',
    timestamps: true,
    indexes: []
  });
  }
}
