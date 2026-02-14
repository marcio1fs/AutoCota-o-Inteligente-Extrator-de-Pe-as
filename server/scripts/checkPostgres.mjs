import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: '.env.server' });
dotenv.config();

const rawUrl = process.env.DATABASE_URL || '';
const shouldUseSsl =
  (process.env.POSTGRES_SSL || '').toLowerCase() === 'true' ||
  /sslmode=require/i.test(rawUrl);

const maskConnectionString = (value) => {
  if (!value) return '';
  return value.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
};

const fail = (message) => {
  console.error(`❌ ${message}`);
  process.exit(1);
};

if (!rawUrl.trim()) {
  fail('DATABASE_URL está vazia em .env.server');
}

let parsedUrl;
try {
  parsedUrl = new URL(rawUrl);
} catch {
  fail('DATABASE_URL inválida (não é uma URL válida)');
}

if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
  fail('DATABASE_URL deve começar com postgres:// ou postgresql://');
}

const pool = new Pool({
  connectionString: rawUrl,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
  max: 1,
});

try {
  const result = await pool.query('SELECT NOW() AS now, current_database() AS db');
  const row = result.rows[0];
  console.log('✅ Conexão com PostgreSQL OK');
  console.log(`• URL: ${maskConnectionString(rawUrl)}`);
  console.log(`• Database: ${row.db}`);
  console.log(`• Time: ${row.now}`);
} catch (error) {
  fail(`Falha na conexão PostgreSQL: ${error.message || 'erro desconhecido'}`);
} finally {
  await pool.end();
}
