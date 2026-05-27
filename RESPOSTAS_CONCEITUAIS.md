# Parte 1.A — Respostas Conceituais

> [!NOTE]
> Respostas conceituais do desafio técnico **CaseCellShop** (nível pleno, fullstack). O case trata da evolução de uma loja virtual que hoje depende diretamente do ERP em todas as jornadas críticas, com foco em três problemas: performance da vitrine, consistência de estoque e resiliência do checkout.

---

## Pergunta 1 — Diagnóstico e trade-offs

### Problema 1 — Performance da vitrine

> A vitrine demora muitos segundos para carregar produtos, frustrando clientes logo no início da jornada.

**Causa provável.** A loja virtual depende diretamente do ERP a cada requisição. Como o ERP é um monolito que também cuida de estoque, faturamento, financeiro e contábil, ele não foi desenhado para responder a milhões de acessos de vitrine em tempo real.

**Impacto.** Para o cliente, navegação lenta, frustração no início da jornada e perda de confiança. Para o negócio, queda de conversão e receita, desperdício de investimento em mídia e desgaste da marca.

**Caminhos possíveis:**

| Caminho | Como funciona | Ganho | Trade-off / risco |
|---------|---------------|-------|-------------------|
| **1. Cachear respostas** | Cache em Redis, cache interno da API ou CDN para catálogo, produtos mais acessados, imagens, descrições e preços | Ganho rápido, baixa complexidade inicial e sem alterar o ERP | Dados podem ficar temporariamente desatualizados (sobretudo preço e estoque); exige TTL e invalidação bem definidos |
| **2. Base própria de leitura** | Banco da loja com uma projeção de produtos, preços e estoque, sincronizada do ERP por jobs periódicos | Mais escalabilidade e menos dependência do ERP nas leituras | Mais complexidade: sincronização, divergências temporárias, reconciliação e monitoramento |

> [!TIP]
> **Priorizaria o cache** das respostas mais acessadas (catálogo, imagens, descrições e preços): é mais rápido, de menor risco e já traz ganho perceptível de performance. Estoque e finalização da compra não confiariam apenas no cache. A base própria de leitura entra como evolução natural, reduzindo ainda mais a dependência do ERP e preparando a loja para uma arquitetura mais escalável.

### Problema 2 — Consistência de estoque

> Vários clientes conseguem comprar o mesmo produto quando o estoque acaba. A empresa está vendendo itens que não possui.

**Causa provável.** O estoque é consultado ou decrementado diretamente no ERP durante o checkout, sem um mecanismo confiável de reserva, bloqueio ou controle de concorrência na camada da loja. Em alto volume, duas ou mais requisições disputam a última unidade ao mesmo tempo.

**Impacto.** Para o cliente, concluir uma compra que depois é cancelada. Para o negócio, retrabalho operacional, estornos, mais atendimento e dano de reputação.

**Caminhos possíveis:**

| Caminho | Como funciona | Ganho | Trade-off / risco |
|---------|---------------|-------|-------------------|
| **1. Reserva de estoque + processamento assíncrono** | A loja controla estoque disponível e reservas. No checkout, uma operação atômica verifica e reserva o estoque antes de criar o pedido; a integração com o ERP roda em background via fila/worker. Sem estoque, a API retorna erro imediato | Evita venda duplicada da última unidade e reduz a dependência do tempo de resposta do ERP no checkout | Exige controle e expiração de reservas, reconciliação com o ERP e estados de pedido bem definidos |
| **2. Validação síncrona no checkout** | Confirma o estoque em tempo real na fonte mais confiável antes de responder ao cliente | Confirmação imediata na própria tela; modelo simples de entender | Mantém o ERP (ou uma consulta síncrona) no fluxo crítico, sujeito a timeout, lentidão e baixa resiliência em picos |

> [!TIP]
> **Priorizaria a reserva de estoque com processamento assíncrono**, porque ataca a causa raiz — a concorrência na última unidade. Permite controlar o estoque na camada da loja, responder rápido ao cliente e integrar com o ERP em segundo plano, sem alterar o ERP central. Depois de amadurecer a sincronização, dá para reavaliar quais trechos do fluxo voltam a ter confirmação em tempo real sem comprometer performance e resiliência.

### Problema 3 — Resiliência do checkout

> Ao finalizar a compra, a API do ERP demora para processar o pedido e gerar faturamento. A requisição sofre timeout e o cliente perde a compra.

**Causa provável.** O checkout depende de uma chamada síncrona ao ERP para concluir toda a compra: a loja aguarda o ERP processar pedido, estoque, faturamento e demais rotinas antes de responder. Sendo o ERP um monolito central e mais lento, qualquer demora ou instabilidade atinge diretamente a experiência de compra.

**Impacto.** Para o cliente, finalizar o checkout sem saber se a compra foi concluída — o que leva a novas tentativas, pedidos duplicados, abandono ou contato com o suporte. Para o negócio, perda de receita, inconsistência de pedidos, retrabalho, mais suporte e risco de duplicidade no ERP.

**Caminhos possíveis:**

| Caminho | Como funciona | Ganho | Trade-off / risco |
|---------|---------------|-------|-------------------|
| **1. Checkout assíncrono com status de pedido** | A loja valida, reserva o estoque e cria o pedido na base própria com status inicial `PENDING_PROCESSING`. Uma fila + worker integram com o ERP em background, evoluindo o status para `CONFIRMED`, `RETRYING` ou `FAILED` | Checkout mais resiliente, menor impacto de timeout do ERP e retries controlados sem duplicar pedidos | Exige estados de pedido, fila, worker, monitoramento, tratamento de falhas e comunicação clara do status ao cliente |
| **2. Checkout síncrono com timeout, retry e fallback** | Mantém o processamento em tempo real, mas melhora a tolerância a falhas: timeouts definidos, retry controlado, circuit breaker, fallback de resposta, logs e mensagens mais claras | Mais simples no início; confirmação imediata quando tudo funciona | Não elimina a dependência do ERP na etapa crítica; em picos o cliente ainda espera ou recebe erro. Retry sem `Idempotency-Key` pode duplicar pedidos |

> [!TIP]
> **Priorizaria o checkout assíncrono com status de pedido**, que resolve a causa raiz — a dependência do tempo de resposta do ERP no checkout. Como primeiro passo: criar o pedido na base da loja, status de processamento, idempotência contra duplicidade e um worker para simular/processar o envio ao ERP. Em seguida, evoluir com retries, monitoramento, alertas e uma tela ou endpoint de consulta de status.

---

## Pergunta 2 — Arquitetura alvo incremental

Proponho uma camada de backend própria da loja, posicionada entre o ERP e o front-end.

### Componentes principais

| Componente | Papel |
|------------|-------|
| **Front-end da loja** | React + TypeScript |
| **Backend da loja** | Node.js + TypeScript; concentra as regras de catálogo, estoque, reserva e pedido |
| **Banco próprio da loja** | Produtos, estoque disponível, reservas, pedidos e controle de idempotência |
| **Cache (ex.: Redis)** | Acelera catálogo, detalhes de produto e estoque de exibição (TTL curto), sempre revalidando no checkout |
| **Fila de processamento** | Envio assíncrono de pedidos ao ERP |
| **Workers / jobs** | Sincronizam dados com o ERP e processam pedidos |
| **ERP** | Mantido como sistema central de faturamento, financeiro e contabilidade |
| **Logs e monitoramento** | Rastreio por `orderId`, `requestId` e `idempotencyKey` |

### Fluxo de produtos

O ERP segue como origem dos dados de produto, mas a loja não o consulta a cada acesso. Um job sincroniza periodicamente produtos e preços para o banco da loja. O front-end consulta a API da loja, que lê do banco próprio e usa cache para os itens mais acessados.

### Fluxo de estoque

A loja mantém uma visão própria do estoque disponível para venda, sincronizada com o ERP e ajustada pelas reservas temporárias do checkout. Na vitrine, o número exibido pode ter pequena defasagem; no checkout, a validação é mais rígida.

### Fluxo de checkout

O cliente escolhe produto e quantidade. A API valida a entrada, verifica o estoque disponível e cria a reserva. Em seguida, grava o pedido com status inicial `PENDING_PROCESSING` e publica uma mensagem na fila. O worker processa o pedido no ERP: em caso de sucesso, o status vai para `CONFIRMED`; em falha temporária, permanece em `PROCESSING`/`RETRYING`; em falha definitiva, vai para `FAILED` e libera a reserva.

### Onde usar cache, fila, banco próprio e workers

- **Cache** — catálogo, detalhes de produto e estoque de exibição (TTL curto, revalidado no checkout).
- **Banco próprio** — produtos, reservas, pedidos e controle de idempotência.
- **Fila** — desacopla o checkout do ERP.
- **Workers** — sincronização de produtos/estoque e processamento de pedidos no ERP.

### Sincronização entre loja e ERP

Começaria com jobs periódicos (a cada poucos minutos) lendo alterações do ERP. Numa evolução, isso pode ser complementado ou substituído por eventos/webhooks, caso o ERP suporte. Uma rotina de reconciliação compararia pedidos, estoque reservado e estoque confirmado no ERP.

### Plano de 30 a 90 dias

| Período | Entregas |
|---------|----------|
| **0–30 dias** | API da loja, banco próprio de produtos e pedidos, cache básico de catálogo e leitura desacoplada do ERP |
| **30–60 dias** | Reserva de estoque, idempotência no checkout, status de pedido e processamento assíncrono via fila/worker |
| **60–90 dias** | Observabilidade, retries, reconciliação com o ERP, testes de concorrência e melhorias de monitoramento |

---

## Pergunta 3 — Estoque, concorrência e idempotência

Se dois clientes tentam comprar a última unidade ao mesmo tempo, a solução precisa garantir que apenas uma operação consiga reservar o estoque.

**Operação atômica.** Usaria uma operação transacional na base da loja: ao tentar comprar, a API verifica o estoque disponível e cria a reserva dentro da mesma transação (por exemplo, um `UPDATE ... WHERE estoque >= quantidade` ou um `SELECT ... FOR UPDATE`). A atomicidade evita que duas requisições decrementem o mesmo estoque simultaneamente.

**Reserva e expiração.** A reserva nasce quando o cliente confirma a tentativa de compra (na requisição `POST /orders`) e tem prazo de expiração — por exemplo, de 10 a 15 minutos. Se o processamento não avança, a reserva expira e o estoque volta a ficar disponível.

**Retry, timeout e duplo clique.** Trataria com uma `Idempotency-Key`: o front-end envia uma chave única por tentativa de compra no header. Se o usuário clica duas vezes ou repete a requisição, a API reconhece a tentativa já existente e devolve o mesmo resultado, em vez de criar outro pedido.

**Estados do pedido:**

| Estado | Significado |
|--------|-------------|
| `PENDING_PROCESSING` | Pedido recebido, aguardando processamento |
| `PROCESSING` | Pedido sendo enviado/processado no ERP |
| `RETRYING` | Falha temporária; aguardando nova tentativa |
| `CONFIRMED` | Pedido confirmado pelo ERP |
| `FAILED` | Falha definitiva |
| `EXPIRED` | Reserva expirada antes da confirmação |
| `CANCELED` | Pedido cancelado |

**Reconciliação.** Jobs periódicos comparariam pedidos processados, reservas abertas e estoque confirmado no ERP. Havendo divergência, o sistema corrige o estoque local, marca pedidos para revisão ou gera alertas operacionais.

---

## Pergunta 4 — Contrato de API e modelo de erros

**Endpoint principal:** `POST /orders`
**Header obrigatório:** `Idempotency-Key: <uuid>`

Resumo do contrato:

| Cenário | HTTP | `errorCode` | Reação do front-end |
|---------|------|-------------|---------------------|
| Sucesso (aceito p/ processamento) | `202 Accepted` | — | Mensagem de sucesso, bloquear novos cliques, exibir status |
| Erro de validação | `400 Bad Request` | `VALIDATION_ERROR` | Destacar campos inválidos e permitir correção |
| Estoque insuficiente | `409 Conflict` | `INSUFFICIENT_STOCK` | Informar indisponibilidade e atualizar a tela |
| Tentativa duplicada | `200 OK` | — | Manter o estado atual; não criar nova compra |
| Falha temporária interna | `503 Service Unavailable` | `TEMPORARY_PROCESSING_ERROR` | Mensagem amigável e retry seguro com a mesma key |

### Payload mínimo de entrada

```json
{
  "productId": "case-iphone-15",
  "quantity": 1,
  "customer": {
    "name": "João Silva",
    "email": "joao@email.com"
  }
}
```

Header enviado na requisição:

```http
Idempotency-Key: 7f3b9c2a-1c4d-4f2a-9b3e-2a1c4d4f2a9b
```

### Resposta de sucesso — `202 Accepted`

```json
{
  "orderId": "ord_123",
  "status": "PENDING_PROCESSING",
  "message": "Pedido recebido e está sendo processado."
}
```

O front-end exibe uma mensagem de sucesso inicial, bloqueia múltiplos cliques e pode mostrar o status do pedido.

### Erro de validação — `400 Bad Request`

```json
{
  "errorCode": "VALIDATION_ERROR",
  "message": "Verifique os dados enviados.",
  "details": [
    { "field": "quantity", "message": "A quantidade deve ser maior que zero." }
  ]
}
```

O front-end destaca os campos inválidos e permite ao usuário corrigir os dados.

### Estoque insuficiente — `409 Conflict`

```json
{
  "errorCode": "INSUFFICIENT_STOCK",
  "message": "Estoque insuficiente para este produto.",
  "availableQuantity": 0
}
```

O front-end informa que o produto não está mais disponível na quantidade selecionada e atualiza a disponibilidade na tela.

### Tentativa duplicada — `200 OK`

```json
{
  "orderId": "ord_123",
  "status": "PENDING_PROCESSING",
  "message": "Esta tentativa de compra já foi recebida anteriormente."
}
```

O `status` retornado reflete o estado atual do pedido já armazenado (pode estar como `PENDING_PROCESSING`, `PROCESSING`, `CONFIRMED` etc.), e não um valor fixo. O front-end mantém o estado anterior, atualiza a tela conforme esse `status` e não cria uma nova compra.

### Falha temporária do ERP ou processamento assíncrono

> [!NOTE]
> O processamento assíncrono já é representado pela própria resposta de sucesso (`202 Accepted` com `PENDING_PROCESSING`): o pedido é aceito e a integração com o ERP ocorre em segundo plano. Falhas do ERP **não** aparecem nesta requisição — são tratadas pelo worker e refletidas no status do pedido (`PROCESSING → RETRYING → FAILED`), que pode ser consultado depois.

A falha que pode ocorrer de forma síncrona é uma indisponibilidade interna da loja (por exemplo, banco ou fila fora do ar), em que o pedido nem chega a ser aceito:

```http
503 Service Unavailable
```

```json
{
  "errorCode": "TEMPORARY_PROCESSING_ERROR",
  "message": "Não foi possível processar o pedido agora. Tente novamente em alguns instantes."
}
```

O front-end mostra uma mensagem amigável, permite retry quando seguro e mantém a `Idempotency-Key` para evitar duplicidade.

---

## Pergunta 5 — Testes e estratégia de validação

A solução seria testada em diferentes camadas.

### Testes unitários

Regras de negócio isoladas:

- validação de quantidade;
- cálculo de estoque disponível;
- criação de reserva;
- expiração de reserva;
- comportamento com `Idempotency-Key`;
- mudança de status do pedido.

### Testes de integração da API

Principais fluxos:

- listar produtos;
- criar pedido com sucesso;
- comprar com quantidade inválida;
- comprar produto inexistente;
- comprar acima do estoque;
- simular falha temporária do ERP;
- repetir a mesma requisição com a mesma `Idempotency-Key`.

### Testes de contrato entre front-end e back-end

Documentaria os formatos esperados de payload e resposta. Se possível, uma especificação OpenAPI ou testes que garantam que o front-end reconhece corretamente `errorCode`, `status` e mensagens.

### Cenários de concorrência

Um teste simulando múltiplas tentativas de compra do mesmo produto ao mesmo tempo, sobretudo com apenas uma unidade em estoque. Resultado esperado: apenas uma compra consegue reservar o estoque.

### Testes de front-end

Estados da interface:

- carregamento da lista de produtos;
- loading durante o checkout;
- botão desabilitado durante o processamento;
- mensagem de sucesso;
- mensagem de estoque insuficiente;
- mensagem de erro de validação;
- mensagem de falha temporária;
- retry sem duplicar pedido.

### O que automatizaria agora

Os testes principais da API — sobretudo estoque, validação, idempotência e concorrência — mais testes básicos do front-end garantindo que mensagens e estados aparecem corretamente.

### O que deixaria como próximo passo

Testes de carga, monitoramento real, testes end-to-end mais completos, integração real com o ERP e testes de resiliência com fila indisponível ou worker fora do ar.

---

## Pergunta 6 — Uso de IA no desenvolvimento

Usei IA como apoio para acelerar a criação de dados mockados, além de análise, organização e revisão de código.

Prompts usados com as seguintes finalidades:

- revisar a arquitetura proposta e apontar riscos;
- sugerir cenários de teste para estoque concorrente;
- revisar o contrato de API;
- gerar ideias de mensagens amigáveis para o front-end;
- ajudar a estruturar o README;
- revisar o código em busca de problemas de validação, duplicidade ou tratamento de erro.

**Exemplo de prompt:**

```txt
Estou desenvolvendo um mini-projeto fullstack de checkout com Node.js, TypeScript e React.
A aplicação precisa lidar com estoque insuficiente, tentativa duplicada, falha temporária
de ERP e validação de entrada.
Revise a arquitetura abaixo e aponte riscos, trade-offs e melhorias sem aumentar demais o escopo.
```

### O que delegaria à IA

Tarefas de apoio: rascunho de documentação, sugestões de testes, revisão de nomes, organização do README e identificação de possíveis cenários de erro.

### O que não delegaria totalmente

Sem revisão, não delegaria decisões de arquitetura, regras de estoque, idempotência, concorrência, segurança e modelo de dados. Essas partes precisam ser entendidas e validadas pelo desenvolvedor.

### Como verificaria se a resposta está correta

Comparando com os requisitos do desafio, executando testes automatizados, revisando manualmente os fluxos críticos e simulando cenários de erro, retry e concorrência.

### Riscos de aceitar sugestão de IA sem revisão

O principal risco é uma solução que parece correta, mas falha em casos complexos, trata erros de forma genérica ou fora do escopo proposto, expõe dados indevidamente ou adiciona complexidade desnecessária. Por isso registraria os prompts relevantes no `PROMPTS.md` e usaria a IA como apoio — não como substituta da validação técnica.
