import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config({ path: '.env.server' });
dotenv.config();

const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];

const fail = (message) => {
  console.error(`❌ ${message}`);
  process.exit(1);
};

for (const name of requiredVars) {
  const value = (process.env[name] || '').trim();
  if (!value) {
    fail(`${name} não configurada em .env.server`);
  }

  if (value.includes('REPLACE_WITH_')) {
    fail(`${name} ainda está com placeholder. Configure valor real.`);
  }
}

const port = Number(process.env.SMTP_PORT || 0);
if (!Number.isFinite(port) || port <= 0) {
  fail('SMTP_PORT inválida. Use um número válido (ex.: 587).');
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: (process.env.SMTP_SECURE || '').toLowerCase() === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

try {
  await transporter.verify();
  console.log('✅ SMTP configurado e autenticado com sucesso');
  console.log(`• Host: ${process.env.SMTP_HOST}`);
  console.log(`• Porta: ${process.env.SMTP_PORT}`);
  console.log(`• Usuário: ${process.env.SMTP_USER}`);
  console.log(`• Remetente: ${process.env.SMTP_FROM}`);
} catch (error) {
  fail(`Falha na validação SMTP: ${error.message || 'erro desconhecido'}`);
}
