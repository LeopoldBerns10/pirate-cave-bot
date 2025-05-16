// db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Railway ajoute cette variable automatiquement
  ssl: { rejectUnauthorized: false }
});

// Pour récupérer les données d'un utilisateur
async function getUserData(userId) {
  const res = await pool.query('SELECT * FROM database_traqueur WHERE user_id = $1', [userId]);
  return res.rows[0] || null;
}

// Pour sauvegarder les données d'un utilisateur
async function saveUserData(userId, username, count, whites, positions) {
  await pool.query(
    `INSERT INTO database_traqueur (user_id, username, count, whites, positions)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
     username = EXCLUDED.username,
     count = EXCLUDED.count,
     whites = EXCLUDED.whites,
     positions = EXCLUDED.positions`,
    [userId, username, count, JSON.stringify(whites), JSON.stringify(positions)]
  );
}

module.exports = {
  getUserData,
  saveUserData
};
