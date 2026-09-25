# Catálogo de Filmes em Streaming

Catálogo de filmes disponíveis agora em serviços de streaming por assinatura no Brasil, usando a API do TMDB.

## Requisitos

- Node.js 20+
- Um banco Postgres (ex.: [Neon](https://neon.tech))

## Configuração

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env` e preencha as variáveis:

   | Variável | Onde obter |
   | --- | --- |
   | `TMDB_READ_TOKEN` | Token de leitura da API em [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) |
   | `DATABASE_URL` | Connection string do seu banco Postgres/Neon |
   | `AUTH_SECRET` | Gere com `npx auth secret` |
   | `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Credenciais OAuth em [console.cloud.google.com](https://console.cloud.google.com/apis/credentials); configure o redirect URI como `<sua-url>/api/auth/callback/google` |
   | `AUTH_RESEND_KEY` | Chave de API em [resend.com](https://resend.com) |
   | `EMAIL_FROM` | Endereço remetente dos e-mails de login (precisa estar verificado no Resend) |

3. Aplique as migrations do banco:

   ```bash
   npx prisma migrate deploy
   ```

4. Rode o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

   Abra [http://localhost:3000](http://localhost:3000).

## Testes

```bash
npm test
```

Os testes de integração (`tests/integration`) precisam de `TEST_DATABASE_URL` apontando para um banco Postgres de teste.

Para os testes end-to-end (Playwright, com TMDB mockado):

```bash
npm run e2e
```

## Deploy

O deploy recomendado é na [Vercel](https://vercel.com/new), configurando as mesmas variáveis de ambiente do `.env.example` no projeto. Rode `npx prisma migrate deploy` contra o banco de produção antes (ou como parte) do primeiro deploy.

## Atribuição

Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB. Os dados de "onde assistir" são fornecidos pela JustWatch e devem ser creditados sempre que exibidos. Este projeto usa uma chave gratuita do TMDB para uso não comercial; monetizar exigiria uma licença comercial do TMDB.
