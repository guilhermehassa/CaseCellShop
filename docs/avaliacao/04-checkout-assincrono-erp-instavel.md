# Caso 04 - Checkout assincrono com ERP instavel

Objetivo: mostrar que o checkout responde na hora e o ERP e tratado em background com retries.

## Premissa deste caso

Ambiente recem-criado com seeders intactos:

- `case-flaky-special` existe com estoque `100`
- esse SKU e marcado como instavel no ERP simulado

## Passo a passo (browser)

1. Abra:

```text
http://localhost:5173/
```

2. Compre `Capinha Edicao Instavel` (SKU `case-flaky-special`) com quantidade `1`.

3. No DevTools -> Network, confira a resposta do `POST /api/orders`.

Esperado:
- HTTP `202`
- `status: "PENDING_PROCESSING"`
- `orderId` presente

Isso ja demonstra que o checkout nao fica bloqueado pelo ERP.

4. Copie o `orderId` retornado e consulte o status em loop:

```powershell
$api = "http://localhost:3000"
$orderId = "COLE_AQUI_O_ORDER_ID"
1..10 | ForEach-Object {
  $r = curl.exe -s "$api/api/orders/$orderId" | ConvertFrom-Json
  "{0}  {1}" -f (Get-Date -Format "HH:mm:ss"), $r.status
  Start-Sleep -Seconds 2
}
```

Esperado:
- transicoes como `PENDING_PROCESSING`, `PROCESSING`, `RETRYING`
- ao final das tentativas, status terminal `FAILED`

## O que isso demonstra

- A compra e aceita primeiro e processada depois.
- Falhas temporarias do ERP nao derrubam o endpoint de checkout.
- O worker aplica retry/backoff ate sucesso ou falha terminal.
