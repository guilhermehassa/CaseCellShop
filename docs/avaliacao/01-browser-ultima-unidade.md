# Caso 01 - Ultima unidade no browser (normal + anonimo)

Objetivo: demonstrar, visualmente, que a ultima unidade nao e vendida duas vezes.

## Premissa deste caso

Ambiente recem-criado com seeders intactos:

- `case-redmi-note-14` com estoque inicial `1`

## Passo a passo

1. Abra no browser:

```text
http://localhost:5173/
```

2. Constate na vitrine que o produto `Capinha Redmi Note 14` aparece com badge `1 disponiveis`.

3. Abra a mesma URL em janela anonima (ou outro navegador), para simular outro cliente.

4. Em cada janela:
- clique em `Comprar` no mesmo produto;
- preencha nome e email;
- mantenha quantidade `1`;
- deixe as duas telas prontas para confirmar.

5. Dispare `Confirmar compra` quase ao mesmo tempo nas duas janelas.

## O que deve acontecer

- Uma tentativa sera aceita com `202` e status inicial `PENDING_PROCESSING` (pedido entrou na fila).
- A outra tentativa recebera `409 INSUFFICIENT_STOCK` (pedido negado por falta de estoque).

## Como comprovar tecnicamente

1. Em cada janela, abra DevTools -> Network e filtre por `POST /api/orders`.

2. Na requisicao aceita, voce vera algo como:
- HTTP `202`
- body com `orderId` e `status: "PENDING_PROCESSING"`

3. Na requisicao negada, voce vera:
- HTTP `409`
- `errorCode: "INSUFFICIENT_STOCK"`

4. Pegue o `orderId` da tentativa aceita e consulte:

```powershell
$api = "http://localhost:3000"
$orderId = "COLE_AQUI_O_ORDER_ID_ACEITO"
curl.exe -s "$api/api/orders/$orderId"
```

Esperado:
- retorno `200`
- status evoluindo entre `PENDING_PROCESSING`, `PROCESSING`, `RETRYING` ou `CONFIRMED`

Observacao:
- hoje nao existe `GET /api/orders` (lista). A consulta de status e por `GET /api/orders/:id`.
