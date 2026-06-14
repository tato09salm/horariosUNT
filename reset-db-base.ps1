npm install
npx sequelize-cli db:drop
npx sequelize-cli db:create
npx sequelize-cli db:migrate
npx sequelize-cli db:seed --seed 20240101000001-demo-escuelas.js --seed 20240101000002-demo-ciclos.js --seed 20240101000003-demo-slots-tiempo.js --seed 20240101000004-demo-ambientes.js --seed 20240101000004-demo-roles.js --seed 20240101000005-demo-usuarios.js --seed 20240101000006-demo-docentes.js --seed 20240101000007-demo-cursos.js --seed 20240101000008-demo-grupos.js --seed 20240101000009-demo-curriculas-config.js
