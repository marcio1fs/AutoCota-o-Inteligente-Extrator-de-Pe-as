<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1YYmvWhl88mWa4TfyVkzbMkf1dXrp6bII

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Backend de Email Profissional (SMTP + anexo Excel)

1. Copie [.env.server.example](.env.server.example) e configure suas credenciais SMTP
2. Inicie a API de email:
   `npm run dev:server`
3. Em outro terminal, inicie o frontend:
   `npm run dev`

Com isso, o envio de cotação passa a anexar automaticamente o Excel no email.

## Login obrigatório no sistema

O sistema agora exige autenticação para acessar a interface e os endpoints protegidos da API.

1. Configure no [.env.server](.env.server):
   - `APP_AUTH_USER`
   - `APP_AUTH_PASSWORD`
   - `APP_AUTH_TOKEN_SECRET`
   - `APP_AUTH_TOKEN_TTL_HOURS` (opcional)
2. Inicie backend e frontend (`npm run dev:all` ou em terminais separados).
3. Faça login na tela inicial com usuário/senha configurados no backend.

Endpoints públicos:

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me` (requer token, usado para validar sessão)

Endpoints protegidos (token obrigatório):

- `POST /api/send-quote-email`
- `GET /api/orders`
- `GET /api/orders/:orderId`

### Persistência com Banco de Dados (PostgreSQL)

- O backend salva histórico de pedidos em PostgreSQL (recomendado: Neon para Vercel).
- Configure `DATABASE_URL` no `.env.server` (e na Vercel em Environment Variables).
- Cada envio cria um registro em `orders` e seus respectivos itens em `order_items`.

Endpoints:

- `GET /api/orders?limit=50` → lista os últimos pedidos enviados
- `GET /api/orders/:orderId` → retorna detalhes de um pedido com itens

## Testes

- Rodar testes unitários backend:
  `npm run test`

## Deploy na Vercel

O projeto está pronto para deploy com frontend (Vite) + API (`/api`) no mesmo domínio.

### 1) Conectar repositório

- Importe o projeto na Vercel.
- Framework preset: `Vite`.

### 2) Variáveis de ambiente (Project Settings → Environment Variables)

Defina no ambiente da Vercel:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_REPLY_TO`
- `APP_AUTH_USER`
- `APP_AUTH_PASSWORD`
- `APP_AUTH_TOKEN_SECRET`
- `APP_AUTH_TOKEN_TTL_HOURS`

Antes do deploy, valide localmente a conexão com Postgres:

- `npm run check:db`

### 3) Deploy

- Faça o deploy normalmente.
- As rotas de API ficam disponíveis em `/api/*` no mesmo domínio do frontend.

### Observação sobre histórico em produção

Com PostgreSQL, o histórico fica persistente entre execuções no ambiente serverless.
