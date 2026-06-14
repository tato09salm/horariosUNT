'use strict';

const Sequelize = require('sequelize');
const configData = require('../config/config.js');
const initModels = require('./init-models');

const env = process.env.NODE_ENV || 'development';
const config = configData[env];

const db = {};

let sequelize;
if (config && config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else if (config) {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
} else {
  // Fallback for safety during build
  sequelize = new Sequelize('sqlite::memory:');
}

const models = initModels(sequelize);

Object.keys(models).forEach(modelName => {
  db[modelName] = models[modelName];
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
