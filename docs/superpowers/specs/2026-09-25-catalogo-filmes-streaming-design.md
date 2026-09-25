# Catálogo de Filmes em Streaming — Design

**Data:** 2026-09-25
**Status:** Aguardando revisão

## 1. Objetivo

Web app público e gratuito que mostra os filmes disponíveis **agora** em serviços de streaming por assinatura no **Brasil**, usando a API do TMDB (dados de "onde assistir" fornecidos pela JustWatch).

**Critérios de sucesso da v1:**
- Usuário navega pelo catálogo de filmes em streaming no Brasil e filtra por serviço, gênero, ano e nota.
- Usuário busca filmes por título.
- Usuário vê detalhes do filme (sinopse, elenco, trailer, onde assistir).
- Usuário logado salva favoritos, lista "quero assistir" e seus serviços assinados.
- Páginas indexáveis por buscadores; atribuição TMDB e JustWatch visível.

## 2. Escopo

**Dentro da v1:** catálogo, filtros (serviço, gênero, ano, nota), busca, página de detalhes, contas (favoritos, quero assistir, meus serviços).

**Fora da v1:** séries, outros países, outros idiomas, aluguel/compra, recomendações personalizadas, notificações, monetização.

**Restrições:**
- Somente região `BR`, idioma `pt-BR`. Região e idioma são constantes em `lib/tmdb/client.ts` (um único lugar), não espalhadas pelo código.
- Somente monetização `flatrate` (assinatura).
- Uso não comercial: chave gratuita do TMDB. Obrigatório exibir logo do TMDB e o aviso "Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB", e creditar a JustWatch onde houver dados de provedores. Monetizar exige licença comercial do TMDB antes.

## 3. Stack

- Next.js (App Router) + TypeScript
- Auth.js (login Google + e-mail/magic link)
- Postgres (Neon) + Prisma
- Zod (validação de env e parâmetros de URL)
- Vitest + MSW (unitários), Playwright (E2E)
- Deploy: Vercel

## 4. Arquitetura

```
Navegador ──> Next.js (App Router, Vercel)
               ├─ Páginas (Server Components)
               │    /              catálogo + filtros (estado na URL)
               │    /busca?q=      busca por título
               │    /filme/[id]    detalhes + onde assistir + trailer
               │    /minha-lista   favoritos e quero assistir (requer login)
               │    /conta         meus serviços (requer login)
               ├─ app/api/catalogo  rota interna para scroll infinito
               ├─ lib/tmdb/         único ponto de contato com o TMDB
               │    client.ts        fetch com token, BR, pt-BR, cache, retry
               │    catalog.ts       discover, search, details, providers, genres
               │    types.ts         tipos de domínio (Movie, MovieDetails, Provider, Genre)
               ├─ lib/auth/         configuração Auth.js
               ├─ lib/db/           cliente Prisma
               └─ Server Actions    favoritar, quero assistir, salvar serviços
```

**Princípios:**
- Somente `lib/tmdb` conhece a API do TMDB. O resto do app consome apenas tipos de domínio. Isso permite trocar por um banco sincronizado no futuro sem mudar as páginas.
- O token do TMDB (`TMDB_READ_TOKEN`) existe apenas no servidor.
- Filtros vivem na URL: `?servicos=8,119&genero=28&ano=2024&nota=7&pagina=2`.
- Se `servicos` não estiver na URL e o usuário estiver logado com serviços salvos, eles são aplicados como padrão.

### Modelo de dados (Prisma)

- `User`, `Account`, `Session`, `VerificationToken` — padrão do adaptador Prisma do Auth.js.
- `ListItem { id, userId, tmdbId Int, type ListType, createdAt }` com `ListType = FAVORITE | WATCHLIST`; único em `(userId, tmdbId, type)`.
- `UserProvider { userId, providerId Int }`; chave primária `(userId, providerId)`.

Nenhum dado de filme é armazenado no banco.

## 5. Fluxo de dados

**Catálogo (`/`):**
1. Server Component lê e valida os filtros da URL (Zod).
2. `catalog.discover(filtros)` chama `/discover/movie` com `watch_region=BR`, `with_watch_monetization_types=flatrate`, `with_watch_providers` (IDs unidos por `|` = qualquer um), `with_genres`, `primary_release_year`, `vote_average.gte`, `language=pt-BR`, `sort_by=popularity.desc`, `page`.
3. Resposta mapeada para `Movie[]`; renderiza a grade (pôster, título, ano, nota).
4. Scroll infinito: o cliente chama `/api/catalogo` com os mesmos filtros e a próxima página; a rota usa a mesma função `discover`.
5. Os cards do catálogo não mostram provedores (evita uma chamada extra por filme). Os provedores aparecem na página de detalhes.
6. Paginação limitada à página 500 (máximo do TMDB).

**Detalhes (`/filme/[id]`):** uma chamada `/movie/{id}?append_to_response=credits,videos,watch/providers`. Usa `watch/providers.results.BR.flatrate` e o `link` da JustWatch. Trailer: primeiro vídeo `site=YouTube, type=Trailer`.

**Busca (`/busca?q=`):** `/search/movie?query=…&region=BR&language=pt-BR`. A busca do TMDB não filtra por streaming, por isso a disponibilidade é mostrada na página de detalhes do filme. Os cards da busca não mostram provedores.

**Listas do usuário:** o banco guarda `tmdbId`; `/minha-lista` busca os detalhes de cada filme via `catalog.details` (em cache). Favoritar e quero assistir usam Server Actions com atualização otimista.

**Cache (`fetch` do Next com `revalidate`):**

| Dado | revalidate |
|---|---|
| Gêneros, lista de provedores BR | 7 dias |
| Discover | 6 horas |
| Busca | 1 hora |
| Detalhes de filme (inclui provedores) | 12 horas |

## 6. Tratamento de erros

- `client.ts`: em 429 ou 5xx, uma nova tentativa respeitando `Retry-After` (padrão 1 s); depois lança `TmdbError { status, endpoint }`.
- Cada rota tem `error.tsx` ("Não conseguimos carregar os filmes agora" + botão tentar novamente). `/filme/[id]` usa `notFound()` quando o TMDB retorna 404.
- Estados vazios: sem resultados para os filtros (botão limpar filtros); filme sem streaming no Brasil; lista vazia.
- Parâmetros de URL inválidos são descartados individualmente, sem erro.
- Ações que exigem login redirecionam para o login com `callbackUrl` da página atual.
- Falha em Server Action desfaz a atualização otimista e exibe um aviso.
- Variáveis de ambiente (`TMDB_READ_TOKEN`, `DATABASE_URL`, `AUTH_SECRET`, credenciais Google, provedor de e-mail) validadas com Zod na inicialização; ausência faz o app falhar imediatamente.

## 7. Testes

- **Unitários (Vitest + MSW, fixtures do TMDB):** mapeamento JSON → domínio; montagem da query do discover a partir dos filtros; parse/validação dos filtros da URL; retry do client (429, 5xx, sucesso após retry, falha final).
- **Integração:** Server Actions de listas e serviços contra Postgres de teste.
- **E2E (Playwright, TMDB mockado):** navegar e filtrar; buscar; abrir detalhes; login e favoritar; ver item em Minha Lista.
- Desenvolvimento em TDD; testes verificam comportamento, não implementação.

## 8. Evolução futura (não implementar agora)

Se os limites da abordagem ao vivo aparecerem (busca filtrada por streaming, provedores nos cards), adicionar um job de sincronização para um banco próprio, substituindo a implementação interna de `lib/tmdb/catalog.ts` sem alterar sua interface.
