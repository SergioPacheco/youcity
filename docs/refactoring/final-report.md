# Relatório da refatoração modular

## Escopo entregue

Os quatro marcos foram executados: baseline e testes essenciais; extração de
catálogo, estado, URL, player e rádio; carregamento sob demanda de mapa, City
Guide, Comment Assistant e providers secundários; remoção de `app.js` e
validação final. A especificação em `docs/specs-refatoração.md` foi preservada
e organizada nesses quatro marcos.

## Validação

Executados com sucesso:

- `npm test` — catálogo, contratos core, loader/async, afiliados, DiscoverCars,
  catálogo de cidades e Comment Assistant.
- `node scripts/build-static.js` — 207 páginas SEO, 206 páginas de cidade,
  207 URLs no sitemap.
- `node scripts/seo-check.js` — passou.
- build e SEO com `SEO_SITE_URL=https://sergiopacheco.github.io`
  e `SEO_BASE_PATH=/youcity` — passaram.
- `node --check` nos módulos `.mjs` — passou.
- artefato gerado — `dist/app.js` ausente; imports estáticos e dinâmicos
  versionados com o mesmo `ASSET_VERSION`.

O smoke de navegador foi tentado com Chromium e Firefox headless disponíveis,
mas ambos terminaram com `SIGSEGV` no ambiente isolado antes de produzir o DOM.
Portanto,
não há evidência válida nesta execução para declarar os fluxos desktop, mobile
e landscape como verificados; eles ficam como validação pendente em ambiente
de navegador funcional.

## Comparação de bytes e requests

Os bytes gzip abaixo são uma estimativa reproduzível com `gzip` sobre os assets,
não uma medição de resposta HTTP comprimida. Brotli, Lighthouse e custo de
parse/execução não estavam disponíveis.

| Medida | Baseline | Após refatoração |
| --- | ---: | ---: |
| Aplicação inicial sem catálogo, raw | 197.188 B | 161.377 B |
| Aplicação inicial sem catálogo, gzip | não separado no baseline | 45.088 B |
| Catálogo, raw | 162.887 B | 162.887 B |
| Catálogo, gzip | 42.743 B | 42.173 B |
| Requests JS locais iniciais | 20 | 26 |

O aumento de requests é consequência deliberada de manter ES Modules nativos
sem bundler. Em contrapartida, mapa, guia, assistente e seis providers
secundários não estão no carregamento inicial. Os chunks lazy publicados incluem
`src/features/map/`, `src/features/city-guide/` e
`src/features/comment-assistant/comment-assistant-controller.mjs` e seus
módulos auxiliares.

## Fora do escopo

Autenticação e segurança dos endpoints, desambiguação avançada do City Guide,
SEO editorial, redesign responsivo, renomeação de analytics, E2E/visual amplo e
divisão do catálogo por cidade permanecem trabalhos separados. `?role=admin`
continua controlando apenas a interface.

## Defeitos e riscos registrados

- Respostas obsoletas de clima e City Guide agora são invalidadas na navegação;
  o caso de troca para uma cidade com cache também invalida a requisição anterior.
- A versionização do build foi ampliada para imports bare, estáticos e dinâmicos;
  antes, apenas alguns assets HTML recebiam a versão.
- O comportamento existente do builder que substitui silenciosamente um alvo
  ausente (`travel-button-full`) foi mantido e permanece documentado no baseline;
  ele não era necessário para concluir esta migração.
- A autenticação administrativa e a proteção dos endpoints não foram alteradas.
