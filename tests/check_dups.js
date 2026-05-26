const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', password: '12345', host: 'localhost', database: 'horariosUNT' });
pool.query("SELECT id, nombre, estado, fase, created_at, config IS NULL as config_is_null FROM programaciones ORDER BY created_at ASC")
  .then(res => {
     console.table(res.rows);
     if(res.rows.length > 1) {
       // delete the newer duplicate
       const toDelete = res.rows[1].id;
       console.log("Deleting duplicate:", toDelete);
       return pool.query("DELETE FROM programaciones WHERE id = $1", [toDelete]);
     }
  })
  .then(() => pool.end())
  .catch(console.error);
