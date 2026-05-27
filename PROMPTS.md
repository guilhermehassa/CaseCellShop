# PROMPTS

Registro dos prompts mais relevantes usados durante a construção da Parte 1.B.
Nenhuma saída foi aceita sem validação com testes, logs ou revisão de código.

## 1. Arquitetura e fluxo de dados
Prompt-base:
```text
Desenhe uma arquitetura para checkout resiliente sem depender do ERP no caminho síncrono.
Inclua cache de catálogo, reserva atômica, idempotência e processamento assíncrono com retries.
```
Uso:
- Definir separação `web/api/worker/erp/dbs`.
- Guiar a divisão em 5 unidades no monorepo.
Validação:
- Conferência contra requisitos do desafio.
- Testes de integração e concorrência para validar efeitos práticos.

## 2. Contrato de API e erros
Prompt-base:
```text
Proponha contrato HTTP para produtos, criação de pedido e status.
Inclua tabela de status code, errorCode e formato único de erro.
```
Uso:
- Padronização de `POST /api/orders` com `Idempotency-Key`.
- Envelope de erro único com `requestId`.
Validação:
- Testes de integração dos desfechos 202/200/400/404/409/422/503.
- Revisão de consistência em API, worker e front.

## 3. Estratégia de idempotência e concorrência
Prompt-base:
```text
Mostre uma estratégia de idempotência robusta para checkout sob concorrência.
Considere retries de rede e double click no front.
```
Uso:
- `Idempotency-Key` + `requestHash`.
- Reserva atômica via transação e update condicional.
Validação:
- Teste de concorrência (última unidade) e teste de chave repetida.

## 4. Worker e retries
Prompt-base:
```text
Descreva máquina de estados para processar pedidos assíncronos com BullMQ:
PROCESSING, RETRYING, CONFIRMED, FAILED, incluindo backoff e timeout.
```
Uso:
- Definição de tentativas máximas e transições de status.
- Estratégia de release/commit de reserva.
Validação:
- Testes do worker e inspeção de logs estruturados.

## 5. Front-end e UX de erro
Prompt-base:
```text
Crie uma UX de checkout com loading, prevenção de duplo clique e mensagens claras
para sucesso, validação, estoque insuficiente e falha temporária.
```
Uso:
- Estados do modal de checkout e polling de status.
- Barra DEV para simular erro temporário.
Validação:
- Testes de front e verificação manual em `localhost:5173`.

## 6. Geração de dados mock
Prompt-base:
```text
Sugira catálogo seed para ecommerce de capinhas com casos especiais para demo:
produto sem estoque, produto com estoque 1, produto instável.
```
Uso:
- Catálogo canônico do ERP para cenários determinísticos.
Validação:
- Seeds idempotentes e cenários cobertos nos testes.
