# Caso 03 - Cache de catalogo em Redis

Objetivo: demonstrar que a vitrine usa cache para `GET /api/products`.

## Premissa deste caso

Ambiente recem-criado com seeders intactos.

## Passo a passo

1. Limpe a chave de cache:

```bash
docker exec casecellshopp-redis redis-cli DEL products:list
```

2. Abra a loja no browser:

```text
http://localhost:5173/
```

3. Apos carregar a vitrine, valide no Redis:

```bash
docker exec casecellshopp-redis redis-cli EXISTS products:list
docker exec casecellshopp-redis redis-cli TTL products:list
```

Esperado:
- `EXISTS = 1`
- `TTL > 0` (por padrao, perto de 20 segundos)

4. Abra a mesma loja em janela anonima e recarregue as duas janelas algumas vezes.

5. Verifique novamente o TTL:

```bash
docker exec casecellshopp-redis redis-cli TTL products:list
```

Esperado:
- a chave continua existindo enquanto nao expira
- o valor de TTL diminui ao longo do tempo

6. Espere o TTL expirar e force nova leitura:

```powershell
Start-Sleep -Seconds 22
docker exec casecellshopp-redis redis-cli EXISTS products:list
curl.exe -s http://localhost:3000/api/products > "$env:TEMP\products-after-expire.json"
docker exec casecellshopp-redis redis-cli TTL products:list
```

Esperado:
- antes da chamada, `EXISTS` pode ser `0`
- apos a chamada, `TTL` volta para valor positivo (cache repopulado)

## O que isso demonstra

- O catalogo e servido por cache-aside.
- Redis reduz leituras repetidas no banco da loja em acessos de vitrine.
