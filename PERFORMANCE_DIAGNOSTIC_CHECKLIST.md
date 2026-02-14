# Checklist de Diagnóstico Profundo (Causa → Evidência → Mitigação)

## Como usar este checklist

1. Rode em produção local (`npm run build && npm run preview`) para evitar ruído do Vite HMR.
2. Abra DevTools Performance e grave interações de 10 a 20 segundos.
3. Use este arquivo para mapear cada sintoma ao ponto de causa mais provável.

---

## 1) Dashboard (Tabela de Cotações)

### Causa possível
- Muitas linhas renderizadas simultaneamente.

### Evidência
- Eventos `click` ou `input` longos ao selecionar itens.
- Quedas de FPS ao rolar lista com centenas de linhas.

### Mitigação
- Virtualização já aplicada em `QuoteTable` para listas grandes.
- Se ainda houver lentidão, aumentar limiar de virtualização ou reduzir conteúdo por linha.

---

## 2) Comparação de Tiers

### Causa possível
- Árvore grande de cards com cálculos por render e múltiplas transições de layout.

### Evidência
- `click handler took > 500ms` ao marcar/desmarcar itens.
- `Forced reflow` quando muitos cards são montados.

### Mitigação
- Renderização progressiva já aplicada com `IntersectionObserver`.
- Debounce em quantidade já aplicado para reduzir commits por tecla.
- Se persistir: reduzir animações CSS em elementos de lista e badges pulsantes.

---

## 3) Extração (IA + Excel)

### Causa possível
- Parsing de planilhas grandes e OCR/processamento com payloads extensos.

### Evidência
- `Long task` durante upload/processamento.
- Trava momentânea ao importar arquivo `.xlsx` com muitas abas.

### Mitigação
- Parsing com `yield` entre abas já aplicado.
- Se persistir: limitar número de abas processadas por vez e mostrar progresso.

---

## 4) Histórico de Pedidos

### Causa possível
- Formatação e renderização de muitas linhas, filtros sem debounce em listas longas.

### Evidência
- Lentidão ao digitar busca com muito histórico.
- Clique em pedido com atraso perceptível.

### Mitigação
- Formatter de moeda reutilizado para reduzir custo por render.
- Se crescer muito: paginação no backend e debounce no campo de busca.

---

## 5) Backend SMTP + SQLite

### Causa possível
- Falha de configuração SMTP ou payload inválido.

### Evidência
- `500` em `/api/send-quote-email`.
- Erros `EAUTH`, `535` ou `SMTP_NOT_CONFIGURED`.

### Mitigação
- Healthcheck disponível em `/api/health`.
- Validação de payload já reforçada no frontend e backend.
- Confirmar variáveis: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

---

## 6) Dependências e segurança

### Causa possível
- Vulnerabilidades em libs de runtime ou incompatibilidade de versão.

### Evidência
- `npm audit` com severidade HIGH.
- Erros estranhos em produção após atualização parcial.

### Mitigação
- Rodar `npm audit --omit=dev` periodicamente.
- Manter lockfile versionado e atualizar de forma controlada.

---

## 7) Instrumentação recomendada

O projeto agora possui monitor de performance em desenvolvimento:

- Arquivo: `services/performanceMonitor.ts`
- Ativação: automática no `App` quando `import.meta.env.DEV`.
- Toggle por ambiente: `VITE_PERF_MONITOR=true|false` (default `true`).

Ele registra:

- Long tasks acima de um limite (default 60ms).
- Event handlers lentos (default 90ms), quando suportado pelo navegador.

### Modo diagnóstico por tela (novo)

Além dos observers nativos, agora há métricas agregadas por tela e ação:

- `dashboard`: `toggle_selection`, `update_quantity`, `remove_item`, `select_winners`
- `extractor`: `process_quote`, `process_quote_error`
- `history`: `load_orders`, `select_order` e variantes de erro

Resumo automático no console a cada ~15s:

- Grupo: `[perf] Screen metrics summary`
- Saída em `console.table` com `count`, `avgMs`, `maxMs`, `lastMs`

Para desligar essa telemetria em desenvolvimento:

- `VITE_PERF_MONITOR=false`

---

## 8) Prioridade de investigação (ordem prática)

1. Validar em `preview` (não em `dev`) e coletar trace.
2. Verificar picos de `click/input` em Comparação.
3. Verificar long tasks em parsing de Excel.
4. Verificar filtros/listagem no Histórico com base grande.
5. Confirmar logs backend e status SMTP quando houver 500.
