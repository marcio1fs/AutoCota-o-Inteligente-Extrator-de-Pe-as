import { QuoteItem } from '../types';

type SupportContext = {
  items: QuoteItem[];
};

type AgentIntent = 'smtp' | 'backend' | 'ai' | 'calculation' | 'history' | 'pricing' | 'workflow' | 'general';

const normalizeQuantity = (value?: number | null) => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(Number(value)));
};

const normalizePrice = (value?: number | null) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
};

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const getQuoteOverview = (items: QuoteItem[]) => {
  const selected = items.filter(item => item.selected);
  const totalQuoted = items.reduce((sum, item) => sum + normalizePrice(item.preco_unitario), 0);
  const totalSelected = selected.reduce((sum, item) => {
    return sum + normalizePrice(item.preco_unitario) * normalizeQuantity(item.quantidade);
  }, 0);

  const supplierCount = new Set(items.map(item => (item.nome_fornecedor || 'Desconhecido').toLowerCase())).size;

  let best: QuoteItem | null = null;
  for (const item of items) {
    const price = normalizePrice(item.preco_unitario);
    if (!best || price < normalizePrice(best.preco_unitario)) {
      best = item;
    }
  }

  return {
    itemCount: items.length,
    selectedCount: selected.length,
    supplierCount,
    totalQuoted,
    totalSelected,
    best,
  };
};

const detectIntent = (message: string): AgentIntent => {
  const lower = message.toLowerCase();

  const hasAny = (...tokens: string[]) => tokens.some(token => lower.includes(token));

  if (/^\s*(sim|ok|blz|beleza|pode|continua|continue|e agora|pr[oó]ximo|proximo)\s*$/i.test(message)) {
    return 'general';
  }

  if (hasAny('smtp', 'email não envia', 'nao envia', 'falha ao enviar', 'eauth', '535', 'fornecedor')) return 'smtp';
  if (hasAny('api', 'backend', 'dev:server', 'health', '500', 'erro 500', '404')) return 'backend';
  if (hasAny('gemini', 'openrouter', 'quota', 'cota', '429', 'ia', 'chave')) return 'ai';
  if (hasAny('soma', 'total', 'quantidade', 'preço', 'preco', 'cálculo', 'calculo')) return 'calculation';
  if (hasAny('histórico', 'historico', 'pedido', 'orders', 'sqlite', 'postgres', 'banco')) return 'history';
  if (hasAny('melhor preço', 'mais barato', 'economia', 'ganhador', 'winners')) return 'pricing';
  if (hasAny('como usar', 'passo a passo', 'fluxo', 'iniciar', 'nova cotação', 'nova cotacao')) return 'workflow';

  return 'general';
};

const inferIntentFromContext = (message: string, items: QuoteItem[]): AgentIntent => {
  const explicit = detectIntent(message);
  if (explicit !== 'general') return explicit;

  const hasItems = items.length > 0;
  const selectedCount = items.filter(item => item.selected).length;

  if (!hasItems) return 'workflow';
  if (selectedCount > 0) return 'pricing';
  return 'calculation';
};

const auditContextRisks = (items: QuoteItem[]) => {
  if (items.length === 0) {
    return ['Sem cotações carregadas no momento.'];
  }

  const missingSupplier = items.filter(item => !(item.nome_fornecedor || '').trim()).length;
  const missingBrand = items.filter(item => !(item.marca || '').trim()).length;
  const invalidPrice = items.filter(item => !Number.isFinite(Number(item.preco_unitario)) || Number(item.preco_unitario || 0) <= 0).length;
  const lowQuantity = items.filter(item => normalizeQuantity(item.quantidade) <= 0).length;
  const selectedCount = items.filter(item => item.selected).length;

  const risks: string[] = [];
  if (missingSupplier > 0) risks.push(`${missingSupplier} item(ns) sem fornecedor.`);
  if (missingBrand > 0) risks.push(`${missingBrand} item(ns) sem marca definida.`);
  if (invalidPrice > 0) risks.push(`${invalidPrice} item(ns) com preço inválido/zero.`);
  if (lowQuantity > 0) risks.push(`${lowQuantity} item(ns) com quantidade inválida.`);
  if (selectedCount === 0) risks.push('Nenhum item selecionado para fechamento de pedido.');

  return risks.length > 0 ? risks : ['Sem riscos críticos detectados nas cotações atuais.'];
};

const nextStepByIntent = (intent: AgentIntent) => {
  switch (intent) {
    case 'workflow':
      return 'Próxima ação sugerida: extraia ao menos 1 cotação na aba Extração e depois vá para Comparação.';
    case 'pricing':
      return 'Próxima ação sugerida: selecione os ganhadores por produto e valide o total por fornecedor antes de enviar.';
    case 'calculation':
      return 'Próxima ação sugerida: revise quantidade por item e confirme se o total selecionado confere com o pedido.';
    case 'smtp':
      return 'Próxima ação sugerida: subir backend SMTP (`npm run dev:server`) e testar `/api/health`.';
    case 'ai':
      return 'Próxima ação sugerida: validar chaves Gemini/OpenRouter e repetir extração com fallback ativo.';
    case 'backend':
      return 'Próxima ação sugerida: confirmar API ativa e endpoints `/api/orders` e `/api/send-quote-email`.';
    case 'history':
      return 'Próxima ação sugerida: enviar um pedido teste e validar o registro no Histórico.';
    default:
      return 'Próxima ação sugerida: descreva o erro exato (mensagem/código) para diagnóstico automático direcionado.';
  }
};

const withAutonomousLayer = (intent: AgentIntent, baseAnswer: string, items: QuoteItem[]) => {
  const risks = auditContextRisks(items)
    .slice(0, 3)
    .map(risk => `- ${risk}`)
    .join('\n');

  return [
    baseAnswer,
    '',
    'Diagnóstico automático do contexto:',
    risks,
    '',
    nextStepByIntent(intent),
  ].join('\n');
};

const buildWorkflowAnswer = () => {
  return [
    'Fluxo recomendado para usar o sistema sem erro:',
    '1) Extraia cotações na aba Extração (texto, PDF, imagem ou Excel).',
    '2) Revise/compare na aba Comparação e ajuste quantidade por item.',
    '3) Selecione ganhadores e finalize o pedido por fornecedor.',
    '4) Envie por email com backend SMTP ativo (`npm run dev:server`).',
    '5) Valide no Histórico se pedido e itens foram gravados corretamente.',
  ].join('\n');
};

const buildSmtpAnswer = () => {
  return [
    'Para falhas de envio SMTP, valide nesta ordem:',
    '- API backend ligada: `npm run dev:server`.',
    '- Variáveis em `.env.server`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.',
    '- Gmail: usar App Password com 2FA (erro comum: `EAUTH`/`535`).',
    '- Teste saúde da API em `/api/health`.',
    '- Se aparecer 500 no envio, copie a mensagem completa para diagnóstico detalhado.',
  ].join('\n');
};

const buildAiAnswer = () => {
  return [
    'Diagnóstico de IA (Gemini/OpenRouter):',
    '- `429`/`RESOURCE_EXHAUSTED`: cota excedida (chave pode estar válida). Aguarde retry e use fallback.',
    '- Sem chave Gemini: configure `VITE_GEMINI_API_KEY`.',
    '- Fallback OpenRouter: configure `VITE_OPENROUTER_API_KEY` e opcionalmente `VITE_OPENROUTER_MODEL`.',
    '- O sistema já tenta Gemini → OpenRouter → parser manual.',
  ].join('\n');
};

const buildBackendAnswer = () => {
  return [
    'Para erros de backend/API:',
    '- Confirme API ativa em `http://localhost:3001/api/health`.',
    '- Verifique proxy `/api` no Vite (frontend deve apontar para backend).',
    '- Se histórico falhar, valide `DATABASE_URL` e acesso ao PostgreSQL.',
    '- Erro `Payload inválido`: conferir campos obrigatórios no envio de email.',
  ].join('\n');
};

const buildCalculationAnswer = (items: QuoteItem[]) => {
  const overview = getQuoteOverview(items);

  return [
    'Regras de cálculo usadas pelo sistema:',
    '- Total por item = preço unitário × quantidade.',
    '- Quantidade mínima sempre é 1.',
    '- Preço inválido/negativo é normalizado para 0.',
    '- Totais são arredondados para 2 casas para evitar erro de ponto flutuante.',
    '',
    `Situação atual: ${overview.itemCount} cotações, ${overview.selectedCount} selecionadas, ${overview.supplierCount} fornecedores.`,
    `Total selecionado (com quantidade): ${BRL.format(overview.totalSelected)}.`,
  ].join('\n');
};

const buildHistoryAnswer = () => {
  return [
    'Sobre histórico de pedidos:',
    '- Cada envio bem-sucedido grava `orders` e `order_items` em PostgreSQL.',
    '- Lista: `GET /api/orders?limit=...`.',
    '- Detalhe: `GET /api/orders/:orderId`.',
    '- Se não aparecer pedido novo, verifique se o envio retornou `success: true`.',
  ].join('\n');
};

const buildPricingAnswer = (items: QuoteItem[]) => {
  const overview = getQuoteOverview(items);
  if (!overview.best) {
    return 'Ainda não há itens para comparar preço. Extraia cotações primeiro na aba de Extração.';
  }

  const price = BRL.format(normalizePrice(overview.best.preco_unitario));
  const supplier = overview.best.nome_fornecedor || 'Desconhecido';
  const product = overview.best.nome_produto || 'Produto';
  const brand = overview.best.marca || 'N/A';

  return [
    `Melhor preço atual: ${product} (${brand}) por ${price} no fornecedor ${supplier}.`,
    `Total selecionado com quantidades: ${BRL.format(overview.totalSelected)}.`,
    'Se quiser, posso te orientar a fechar por fornecedor com menor custo total.',
  ].join('\n');
};

const buildGeneralAnswer = (items: QuoteItem[]) => {
  const overview = getQuoteOverview(items);
  return [
    'Posso te ajudar com operação e troubleshooting do sistema inteiro:',
    '- Extração IA (Gemini/OpenRouter/fallback manual)',
    '- Comparação, seleção e cálculo por quantidade',
    '- Envio SMTP com anexo Excel',
    '- Histórico de pedidos (PostgreSQL/API)',
    '',
    `Contexto atual: ${overview.itemCount} cotações carregadas e total selecionado de ${BRL.format(overview.totalSelected)}.`,
    'Me diga seu problema (ex.: “erro 500 no envio”, “quota 429”, “pedido não aparece no histórico”).',
  ].join('\n');
};

export const getSupportAgentResponse = async (message: string, context: SupportContext): Promise<string> => {
  const { items } = context;
  const intent = inferIntentFromContext(message, items);

  const reply = (() => {
    switch (intent) {
      case 'workflow':
        return buildWorkflowAnswer();
      case 'smtp':
        return buildSmtpAnswer();
      case 'ai':
        return buildAiAnswer();
      case 'backend':
        return buildBackendAnswer();
      case 'calculation':
        return buildCalculationAnswer(items);
      case 'history':
        return buildHistoryAnswer();
      case 'pricing':
        return buildPricingAnswer(items);
      default:
        return buildGeneralAnswer(items);
    }
  })();

  return withAutonomousLayer(intent, reply, items);
};

export const getSupportAgentResponseWithMetadata = async (
  message: string,
  context: SupportContext
): Promise<{ text: string; intent: string; actionPlan: string }> => {
  const { items } = context;
  const intent = inferIntentFromContext(message, items);
  const text = await getSupportAgentResponse(message, context);
  const actionPlan = nextStepByIntent(intent);

  return {
    text,
    intent,
    actionPlan,
  };
};
