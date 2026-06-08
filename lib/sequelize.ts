import { Sequelize } from 'sequelize';
import initModels from '@/models/init-models';
import configData from '@/config/config.js';
import pg from 'pg';

const env = process.env.NODE_ENV || 'development';
const config = (configData as any)[env];

let sequelize: Sequelize;

const sequelizeOptions = {
  ...config,
  dialectModule: pg,
  define: {
    timestamps: false
  }
};

if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable]!, sequelizeOptions);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, sequelizeOptions);
}

const db = {
  ...initModels(sequelize),
  sequelize,
  Sequelize,
};

export default db;
