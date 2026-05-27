# CaseCellShop

Fluxo fullstack de checkout para venda de capinhas, com foco em:
- vitrine rápida (projeção local + cache Redis),
- prevenção de oversell (reserva atômica + idempotência),
- resiliência ao ERP instável (processamento assíncrono com fila + worker).

## Stack e justificativa
- Node.js + TypeScript: padroniza backend/worker e reduz erro de contrato.
- React + TypeScript + Vite + Tailwind: front simples, rápido para iteração.
- PostgreSQL (loja) + MySQL (ERP simulado): mantém fidelidade ao cenário do desafio.
- Prisma: migrations, seeders idempotentes e acesso consistente a dados.
- Redis + BullMQ: cache de catálogo e orquestração de jobs assíncronos.
- Docker Compose: sobe toda a topologia com um comando.

## Arquitetura
- Visão detalhada em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- Monorepo separado em 5 unidades:
1. `apps/store-web`
2. `apps/store-api`
3. `apps/erp`
4. `packages/store-db`
5. `packages/erp-db`

## Como rodar
```bash
cp .env.example .env
docker compose up --build
```

Serviços:
- Web: http://localhost:5173
- API Loja: http://localhost:3000
- ERP Simulado: http://localhost:4000

## Reset e restore dos bancos
```bash
docker compose down -v && docker compose up --build
npm run db:reset
```

Notas:
- `down -v && up --build` recria o ambiente completo.
- `npm run db:reset` executa reset lógico em ordem ERP -> loja, com migrations + seed.

## Contrato da API (resumo)

### `GET /api/products`
- `200`: lista catálogo projetado do ERP.

### `GET /api/products/:id`
- `200`: produto encontrado.
- `404 PRODUCT_NOT_FOUND`.

### `POST /api/orders`
Header obrigatório:
- `Idempotency-Key: <uuid-v4>`

Respostas:
- `202`: pedido aceito (`PENDING_PROCESSING`).
- `200`: tentativa duplicada com mesma chave+payload (retorna mesmo `orderId`).
- `400 VALIDATION_ERROR`.
- `404 PRODUCT_NOT_FOUND`.
- `409 INSUFFICIENT_STOCK`.
- `422 IDEMPOTENCY_KEY_REUSED`.
- `503 TEMPORARY_PROCESSING_ERROR` (hook de debug).

### `GET /api/orders/:id`
- `200`: status atual do pedido.
- `404 ORDER_NOT_FOUND`.

Envelope de erro:
```json
{
  "errorCode": "STRING_UPPER_SNAKE",
  "message": "mensagem amigável",
  "details": [],
  "requestId": "req_..."
}
```

## Como testar
```bash
npm test
```

Cenários rápidos para demo:
- Sucesso: `case-iphone-15`
- Estoque insuficiente: `case-moto-g84`
- Concorrência/última unidade: `case-iphone-14`
- Retry/falha temporária no ERP: `case-flaky-special`
- Falha temporária da loja: barra DEV no front (`X-Debug-Force-Error: temporary`)

## Variáveis de ambiente principais

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Postgres da loja |
| `ERP_DATABASE_URL` | MySQL do ERP |
| `REDIS_URL` | cache + BullMQ |
| `ERP_BASE_URL` | URL do ERP para o worker |
| `PORT` | porta da API |
| `ERP_PORT` | porta do ERP |
| `ORDER_MAX_ATTEMPTS` | máximo de retries no worker |
| `ORDER_BACKOFF_MS` | backoff base entre retries |
| `ERP_TIMEOUT_MS` | timeout por chamada ao ERP |
| `SYNC_INTERVAL_MS` | frequência do sync ERP -> loja |
| `RESERVATION_REAPER_INTERVAL_MS` | frequência do reaper |
| `DEBUG_HOOKS` | ativa hook de erro temporário na API |
| `ERP_ALLOW_SCENARIO_HEADER` | ativa `X-Erp-Scenario` no ERP |

## Catálogo seed (ERP)

| SKU | Estoque inicial | Uso na demo |
|---|---:|---|
| `case-iphone-15` | 50 | fluxo de sucesso |
| `case-iphone-14` | 1 | concorrência/última unidade |
| `case-galaxy-s24` | 30 | fluxo regular |
| `case-galaxy-a55` | 18 | fluxo regular |
| `case-pixel-9` | 12 | fluxo regular |
| `case-xiaomi-14` | 8 | fluxo regular |
| `case-moto-g84` | 0 | estoque insuficiente |
| `case-flaky-special` | 100 | instabilidade/retries |
| `case-asus-rog` | 25 | fluxo regular |

## Decisões e trade-offs
- Checkout assíncrono: melhora resiliência, mas introduz consistência eventual de status.
- Cache Redis com TTL curto: reduz carga no banco, com risco controlado de dados levemente defasados.
- Reserva atômica no banco da loja: elimina oversell no ponto crítico de concorrência.
- Idempotência por chave + hash: evita pedidos duplicados por retry/double click.
- ERP simulado separado: facilita reproduzir latência/falhas de forma determinística.

## Limitações
- Sem autenticação/autorização.
- Sem integração de pagamento real.
- ERP é simulado.
- Reconciliação de estoque é básica (polling).
- Sem observabilidade externa (APM/tracing distribuído).

## Próximos passos
1. OpenTelemetry + tracing ponta a ponta.
2. Contrato OpenAPI público.
3. E2E browser tests.
4. Testes de carga e caos mais extensos.
5. Estratégia de reconciliação dirigida a eventos/webhooks.

## Links
- Respostas conceituais: [RESPOSTAS_CONCEITUAIS.md](RESPOSTAS_CONCEITUAIS.md)
- Prompts usados: [PROMPTS.md](PROMPTS.md)
- Arquitetura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
