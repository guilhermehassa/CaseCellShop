# Caso 02 - Idempotencia e tentativa duplicada

Objetivo: provar que reenviar a mesma compra (mesma chave) nao cria novo pedido.

## Premissa deste caso

Ambiente recem-criado com seeders intactos.

## Passo a passo (browser + terminal)

1. Abra:

```text
http://localhost:5173/
```

2. Compre `Capinha iPhone 15` (quantidade 1) uma vez.

3. No DevTools -> Network, abra a requisicao `POST /api/orders` dessa compra e copie:
- `Idempotency-Key` do header
- payload enviado (`productId`, `quantity`, `customer`)
- `orderId` retornado no body (resposta `202`)

4. Reenvie exatamente o mesmo request no terminal:

```powershell
$api = "http://localhost:3000"
$key = "COLE_AQUI_A_IDEMPOTENCY_KEY"
$payload = '{"productId":"case-iphone-15","quantity":1,"customer":{"name":"NOME","email":"EMAIL"}}'

$status = curl.exe -s -o "$env:TEMP\idem-1.json" -w "%{http_code}" `
  -X POST "$api/api/orders" `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: $key" `
  -d $payload

"status=$status"
Get-Content "$env:TEMP\idem-1.json"
```

Esperado:
- HTTP `200`
- mesmo `orderId` da chamada original
- mensagem de tentativa ja recebida

5. Reuse a mesma chave, mas altere o payload (exemplo: `quantity: 2`):

```powershell
$payloadChanged = '{"productId":"case-iphone-15","quantity":2,"customer":{"name":"NOME","email":"EMAIL"}}'

$status2 = curl.exe -s -o "$env:TEMP\idem-2.json" -w "%{http_code}" `
  -X POST "$api/api/orders" `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: $key" `
  -d $payloadChanged

"status=$status2"
Get-Content "$env:TEMP\idem-2.json"
```

Esperado:
- HTTP `422`
- `errorCode: "IDEMPOTENCY_KEY_REUSED"`

## O que isso demonstra

- Retry seguro nao duplica pedido.
- A chave de idempotencia esta vinculada ao hash do payload.
- Reuso da mesma chave com outro conteudo e bloqueado.
