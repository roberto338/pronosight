// ══════════════════════════════════════════════
// db/database.js — Connexion PostgreSQL
// Pool partagé pour toute l'application
// ══════════════════════════════════════════════

import pg from 'pg';
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL manquante — PostgreSQL désactivé');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Limites adaptées au free tier Render
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Vérification connexion au démarrage
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erreur connexion PostgreSQL:', err.message);
    return;
  }
  release();
  console.log('✅ PostgreSQL connecté');
});

// Gestion erreurs pool
pool.on('error', (err) => {
  console.error('❌ Erreur inattendue pool PostgreSQL:', err.message);
});

/**
 * Exécute une requête SQL paramétrée
 * @param {string} text  — requête SQL avec $1, $2...
 * @param {Array}  params — valeurs
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`⚠️ Requête lente (${duration}ms):`, text.slice(0, 80));
    }
    return result;
  } catch (err) {
    console.error('❌ Erreur requête SQL:', err.message);
    console.error('   Requête:', text.slice(0, 120));
    throw err;
  }
}

/**
 * Retourne un client dédié pour les transactions
 * Penser à appeler client.release() après usage
 */
export async function getClient() {
  const client = await pool.connect();
  return client;
}

export default pool;
