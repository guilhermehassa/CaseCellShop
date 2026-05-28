# Avaliacao da Solucao - Parte 1.B (Cenario Seed Limpo)

Esta pasta foi reescrita para demonstracao manual, pensando no avaliador abrindo o projeto do zero.

## Premissa obrigatoria dos exemplos

Todos os passos abaixo assumem ambiente recem-criado, com dados exatamente como os seeders.

1. Opcao rapida (recomendada) para restaurar seed:

```bash
npm run eval:reset
```

2. Opcao completa (recria volumes):

```bash
docker compose down -v
docker compose up --build
```

3. Confirme a API:

```bash
curl.exe -s http://localhost:3000/health
```

4. Acesse o front:

```text
http://localhost:5173/
```

## Dados de seed usados como referencia

- `case-redmi-note-14`: estoque inicial `1`
- `case-iphone-14`: estoque inicial `1`
- `case-moto-g84`: estoque inicial `0`
- `case-flaky-special`: estoque inicial `100` (produto marcado como instavel no ERP)

## Casos documentados

- [01 - Ultima unidade no browser (normal + anonimo)](./01-browser-ultima-unidade.md)
- [02 - Idempotencia e tentativa duplicada](./02-idempotencia-tentativa-duplicada.md)
- [03 - Cache de catalogo em Redis](./03-cache-catalogo-redis.md)
- [04 - Checkout assincrono com ERP instavel](./04-checkout-assincrono-erp-instavel.md)
