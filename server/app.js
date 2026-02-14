import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { EmailPayloadSchema, normalizeQuoteItem, buildEmailText } from './lib/quoteUtils.js';
import { initDatabase, saveOrder, listOrders, getOrderWithItems, getDatabasePath } from './lib/orderRepository.js';

dotenv.config({ path: '.env.server' });
dotenv.config();

const AUTH_USERNAME = (process.env.APP_AUTH_USER || '').trim();
const AUTH_PASSWORD = process.env.APP_AUTH_PASSWORD || '';
const AUTH_SECRET = process.env.APP_AUTH_TOKEN_SECRET || 'change-this-secret-in-env';
const AUTH_TTL_HOURS = Math.max(1, Number(process.env.APP_AUTH_TOKEN_TTL_HOURS || 12));

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

initDatabase().catch((error) => {
  if (error?.message === 'DATABASE_URL_NOT_CONFIGURED') {
    console.warn('DATABASE_URL não configurada. Endpoints de histórico/registro ficarão indisponíveis até configurar Postgres.');
    return;
  }

  console.error('Falha ao inicializar Postgres:', error);
});

const toBase64Url = (value) => Buffer.from(value).toString('base64url');

const signToken = (encodedPayload) =>
  crypto.createHmac('sha256', AUTH_SECRET).update(encodedPayload).digest('base64url');

const buildAuthToken = (username) => {
  const payload = {
    u: username,
    exp: Date.now() + AUTH_TTL_HOURS * 60 * 60 * 1000,
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signToken(encodedPayload);
  return `${encodedPayload}.${signature}`;
};

const parseBearerToken = (authorizationHeader) => {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') return '';
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return '';
  return token.trim();
};

const verifyAuthToken = (token) => {
  if (!token || typeof token !== 'string') return null;

  const [encodedPayload, providedSignature] = token.split('.');
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = signToken(encodedPayload);
  if (providedSignature.length !== expectedSignature.length) return null;

  const isMatch = crypto.timingSafeEqual(
    Buffer.from(providedSignature),
    Buffer.from(expectedSignature)
  );

  if (!isMatch) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!payload?.u || typeof payload.exp !== 'number') return null;
  if (payload.exp < Date.now()) return null;

  return { username: String(payload.u), exp: payload.exp };
};

const requireAuth = (req, res, next) => {
  if (!AUTH_USERNAME || !AUTH_PASSWORD) {
    return res.status(500).json({
      success: false,
      message: 'Login não configurado no servidor. Defina APP_AUTH_USER e APP_AUTH_PASSWORD.',
    });
  }

  const token = parseBearerToken(req.headers.authorization);
  const session = verifyAuthToken(token);
  if (!session) {
    return res.status(401).json({ success: false, message: 'Não autenticado.' });
  }

  req.auth = session;
  next();
};

const buildAttachmentBuffer = (items) => {
  const workbook = XLSX.utils.book_new();

  const rows = items.map((item) => {
    const quantity = Math.max(1, Math.floor(item?.quantidade || 1));
    const unitPrice = item.preco_unitario || 0;

    return {
      'DESCRIÇÃO DO PRODUTO': item.nome_produto,
      'CÓDIGO/REFERÊNCIA': item.codigo_referencia,
      'MARCA': item.marca,
      'PREÇO UNIT. (R$)': unitPrice,
      'QUANTIDADE': quantity,
      'TOTAL (R$)': unitPrice * quantity,
      'SIMILARES': ''
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const total = items.reduce((acc, i) => {
    const quantity = Math.max(1, Math.floor(i?.quantidade || 1));
    return acc + (i.preco_unitario || 0) * quantity;
  }, 0);

  XLSX.utils.sheet_add_aoa(worksheet, [
    [],
    ['', '', '', '', 'TOTAL DO PEDIDO:', total]
  ], { origin: -1 });

  worksheet['!cols'] = [
    { wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 30 }
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedido');
  const binary = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(binary) ? binary : Buffer.from(binary);
};

const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP_NOT_CONFIGURED');
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'email-api', timestamp: new Date().toISOString(), database: 'postgres', databasePath: getDatabasePath() });
});

app.post('/api/auth/login', (req, res) => {
  const username = (req.body?.username || '').toString().trim();
  const password = (req.body?.password || '').toString();

  if (!AUTH_USERNAME || !AUTH_PASSWORD) {
    return res.status(500).json({
      success: false,
      message: 'Login não configurado no servidor. Defina APP_AUTH_USER e APP_AUTH_PASSWORD.',
    });
  }

  if (username !== AUTH_USERNAME || password !== AUTH_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos.' });
  }

  const token = buildAuthToken(username);
  return res.json({
    success: true,
    token,
    expiresInHours: AUTH_TTL_HOURS,
    user: { username },
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, user: { username: req.auth.username }, exp: req.auth.exp });
});

app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/auth/login' || req.path === '/auth/me') {
    return next();
  }
  return requireAuth(req, res, next);
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await listOrders({ limit: req.query?.limit });
    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    if (error?.message === 'DATABASE_URL_NOT_CONFIGURED') {
      return res.status(500).json({ success: false, message: 'DATABASE_URL não configurada no servidor.' });
    }
    console.error('Erro ao listar pedidos:', error);
    res.status(500).json({ success: false, message: 'Falha ao listar pedidos.' });
  }
});

app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const order = await getOrderWithItems(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
    }

    res.json({ success: true, order });
  } catch (error) {
    if (error?.message === 'DATABASE_URL_NOT_CONFIGURED') {
      return res.status(500).json({ success: false, message: 'DATABASE_URL não configurada no servidor.' });
    }
    console.error('Erro ao buscar pedido:', error);
    res.status(500).json({ success: false, message: 'Falha ao buscar pedido.' });
  }
});

app.post('/api/send-quote-email', async (req, res) => {
  try {
    const parsed = EmailPayloadSchema.parse(req.body);
    const normalizedItems = parsed.items.map(normalizeQuoteItem);
    const textBody = buildEmailText({ ...parsed, items: normalizedItems });
    if (normalizedItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum item válido para anexar.' });
    }

    const attachment = buildAttachmentBuffer(normalizedItems);
    if (!attachment || attachment.length === 0) {
      return res.status(500).json({ success: false, message: 'Falha ao gerar anexo Excel com itens.' });
    }

    const transporter = createTransporter();

    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
    await transporter.sendMail({
      from: fromAddress,
      to: parsed.to_email,
      subject: parsed.subject,
      text: textBody,
      replyTo: process.env.SMTP_REPLY_TO || undefined,
      attachments: [
        {
          filename: `Pedido_${new Date().toISOString().slice(0, 10)}.xlsx`,
          content: attachment,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      ]
    });

    const persisted = await saveOrder({
      email: parsed,
      items: normalizedItems,
    });

    res.json({ success: true, message: 'Email enviado com anexo Excel.', orderId: persisted.orderId });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ success: false, message: 'Payload inválido.', errors: error.issues });
    }

    if (error?.message === 'SMTP_NOT_CONFIGURED') {
      return res.status(500).json({
        success: false,
        message: 'SMTP não configurado. Defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e SMTP_FROM.'
      });
    }

    if (error?.message === 'DATABASE_URL_NOT_CONFIGURED') {
      return res.status(500).json({
        success: false,
        message: 'DATABASE_URL não configurada no servidor.'
      });
    }

    if (error?.code === 'EAUTH') {
      return res.status(500).json({
        success: false,
        message: 'Falha de autenticação SMTP. Para Gmail, use App Password (16 caracteres) com 2FA ativado.'
      });
    }

    if (error?.responseCode === 535) {
      return res.status(500).json({
        success: false,
        message: 'Credenciais SMTP rejeitadas pelo provedor. Verifique usuário/senha e use App Password no Gmail.'
      });
    }

    console.error('Erro ao enviar email:', error);
    return res.status(500).json({ success: false, message: `Falha ao enviar email pelo backend: ${error?.message || 'erro desconhecido'}` });
  }
});

export default app;
