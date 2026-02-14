import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || '';
const shouldUseSsl =
  (process.env.POSTGRES_SSL || '').toLowerCase() === 'true' ||
  /sslmode=require/i.test(connectionString);

let pool;
let initPromise;

const getPool = () => {
  if (pool) return pool;

  if (!connectionString) {
    throw new Error('DATABASE_URL_NOT_CONFIGURED');
  }

  pool = new Pool({
    connectionString,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });

  return pool;
};

export const initDatabase = async () => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const currentPool = getPool();
    await currentPool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id BIGSERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        to_email TEXT NOT NULL,
        to_name TEXT NOT NULL,
        from_name TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        item_count INTEGER NOT NULL,
        total_amount DOUBLE PRECISION NOT NULL
      );
    `);

    await currentPool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        nome_produto TEXT NOT NULL,
        codigo_referencia TEXT,
        marca TEXT,
        nome_fornecedor TEXT,
        preco_unitario DOUBLE PRECISION NOT NULL,
        quantidade INTEGER NOT NULL,
        total_item DOUBLE PRECISION NOT NULL
      );
    `);

    await currentPool.query('CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);');
    await currentPool.query('CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);');
  })();

  return initPromise;
};

const ensureInitialized = async () => {
  await initDatabase();
  return getPool();
};

export const saveOrder = async ({ email, items }) => {
  const currentPool = await ensureInitialized();
  const client = await currentPool.connect();
  const safeItems = Array.isArray(items) ? items : [];
  const totalAmount = safeItems.reduce((sum, item) => {
    const quantity = Math.max(1, Math.floor(item?.quantidade || 1));
    return sum + (item?.preco_unitario || 0) * quantity;
  }, 0);

  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `
      INSERT INTO orders (
        to_email,
        to_name,
        from_name,
        subject,
        message,
        item_count,
        total_amount
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
      `,
      [
        email.to_email,
        email.to_name,
        email.from_name,
        email.subject,
        email.message,
        safeItems.length,
        totalAmount,
      ]
    );

    const orderId = Number(orderResult.rows[0]?.id);

    for (const item of safeItems) {
      const quantity = Math.max(1, Math.floor(item?.quantidade || 1));
      const unitPrice = item?.preco_unitario || 0;

      await client.query(
        `
        INSERT INTO order_items (
          order_id,
          nome_produto,
          codigo_referencia,
          marca,
          nome_fornecedor,
          preco_unitario,
          quantidade,
          total_item
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          orderId,
          item?.nome_produto || 'Peça Automotiva',
          item?.codigo_referencia || 'N/A',
          item?.marca || 'N/A',
          item?.nome_fornecedor || 'Desconhecido',
          unitPrice,
          quantity,
          unitPrice * quantity,
        ]
      );
    }

    await client.query('COMMIT');
    return { orderId, totalAmount, itemCount: safeItems.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const listOrders = async ({ limit = 50 } = {}) => {
  const currentPool = await ensureInitialized();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);

  const { rows } = await currentPool.query(
    `
    SELECT
      id,
      created_at,
      to_email,
      to_name,
      from_name,
      subject,
      item_count,
      total_amount
    FROM orders
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  return rows;
};

export const getOrderWithItems = async (orderId) => {
  const currentPool = await ensureInitialized();
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const orderResult = await currentPool.query(
    `
    SELECT
      id,
      created_at,
      to_email,
      to_name,
      from_name,
      subject,
      message,
      item_count,
      total_amount
    FROM orders
    WHERE id = $1
    `,
    [id]
  );

  const order = orderResult.rows[0];
  if (!order) return null;

  const itemsResult = await currentPool.query(
    `
    SELECT
      nome_produto,
      codigo_referencia,
      marca,
      nome_fornecedor,
      preco_unitario,
      quantidade,
      total_item
    FROM order_items
    WHERE order_id = $1
    ORDER BY id ASC
    `,
    [id]
  );

  return { ...order, items: itemsResult.rows };
};

export const getDatabasePath = () => connectionString ? 'postgresql://***' : 'not-configured';
