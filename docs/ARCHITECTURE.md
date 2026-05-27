# Arquitetura CaseCellShop

## Visão geral

```mermaid
flowchart LR
  U[Usuário] --> W[Store Web<br/>React + Vite]
  W --> A[Store API<br/>Express + TS]
  A --> R[(Redis<br/>cache + fila)]
  A --> P[(Postgres<br/>loja)]
  A --> Q[Queue process-order]
  Q --> K[Worker<br/>BullMQ]
  K --> E[ERP Simulado<br/>Express + TS]
  E --> M[(MySQL ERP)]
```

## Sequência de checkout

```mermaid
sequenceDiagram
  participant UI as Store Web
  participant API as Store API
  participant PG as Postgres Loja
  participant Q as BullMQ/Redis
  participant WK as Worker
  participant ERP as ERP Simulado
  participant MY as MySQL ERP

  UI->>API: POST /api/orders + Idempotency-Key
  API->>PG: valida idempotência + reserva atômica
  API->>Q: enqueue(orderId, requestId, idempotencyKey)
  API-->>UI: 202 PENDING_PROCESSING

  WK->>Q: consome job process-order
  WK->>ERP: POST /erp/orders (timeout + retry)
  ERP->>MY: cria/persiste pedido ERP
  ERP-->>WK: 200/201 ou 409/503/timeout
  WK->>PG: CONFIRMED ou FAILED/RETRYING
  UI->>API: GET /api/orders/:id (polling)
  API-->>UI: status atualizado
```

## Decisões principais
- Checkout não bloqueia no ERP.
- Estoque é protegido no banco da loja com operação atômica.
- Idempotência impede pedido duplicado em retries/double click.
- Worker centraliza integração instável com ERP.
