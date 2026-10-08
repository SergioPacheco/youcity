# Análise CRUEL — YouCity

> Data: 2026-09-22 · Escopo: implementação do site (front-end, Pages Functions, build, testes, SEO/affiliate)

## Veredito
Site bonito, ambicioso, com 25 suítes de teste **passando** — mas por baixo há uma "porta de admin" de açucareiro, um deserto de testes que mede *nada* executável, dados duplicados em 3 fontes de verdade e features que **se auto-sabotam com o próprio header**. Parece um portfólio em produção, não um produto.

---

## 1. SEGURANÇA (o mais grave)

### Você vira "admin" com um parâmetro de URL
```js
// src/app/dom.mjs:36
export function hasAdminRole(window) {
  return new URLSearchParams(window.location.search).get("role")?.toLowerCase() === "admin";
}
```
`?role=admin` liga o **Comment Assistant** (feature "admin-only"), que chama `/api/youtube-metadata` no servidor. Não há sessão, cookie, token ou validação server-side — o worker **não valida role nenhum** (`functions/api/youtube-metadata.js`). O conceito de "admin" aqui é uma brincadeira de fingir. Se essa feature um dia ganhar alguma ação sensível (postar em rede social, moderar algo), qualquer pessoa tem acesso.

### Zero Content-Security-Policy
`_headers` tem `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` — mas **nenhum CSP**. Num site com script inline (`onclick="location.reload()"` em `bootstrap.mjs:1140`), GTM inline, iframes de YouTube/Stay22/Leaflet e 40+ arquivos JS servidos com `max-age=3600`, um XSS em qualquer dependência terceira é absurdamente fácil.

### Rate-limit e cache de memória com crescimento infinito
```js
// functions/api/radio-stations.js:10
const cache = new Map();
const rateLimits = new Map();
```
Cache e rate-limit vivem em `Map` na instância do worker, **crescem para sempre** (uma entrada por vídeo/URL/IP único). Em produção com tráfego, isso é vazamento de memória lento. E o fallback de chave de rate-limit `"anonymous"` significa que requests sem `cf-connecting-ip` compartilham a mesma cota.

---

## 2. TESTES: teatro com figurino de qualidade

### O "teste de performance" é regex em texto-fonte
```js
// scripts/test-startup-performance.mjs:12
assert.match(selectCity, /if\s*\(isCityDrawerOpen\(\)\)\s*renderGrid\(elements\.search\.value\)/);
```
**Nenhuma medida de runtime.** Nenhum `performance.now()`, nenhum Lighthouse, nenhum navegador real. O `test-architecture.mjs` apenas confere que arquivos existem (`existsSync`) e que arquivos legados *não* existem. Os 25 testes rodam em menos de um minuto porque nenhum deles faz nada além de `assert.match` e `assert.doesNotMatch` em strings.

### E isso é pior do que parece
Quando o teste "afirma" que ad foi excluído do build (`test-startup-performance.mjs:78`) ou que o LCP é um `<img>` (`:34`), o sistema está **congelando decisões de código em regex** que qualquer refactor quebre silenciosamente, sem nunca validar o comportamento real (LCP, CLS, TBT medidos). É _coverage theater_: cobre texto, não comportamento.

---

## 3. ARQUITETURA: god-object disfarçado de "modular"

### `bootstrap.mjs` — 1654 linhas de closure monolítico
Apesar de quase 50 módulos, o `bootstrap.mjs` acumula: 4 tabelas de dados hardcoded (`COUNTRY_INFO`, `CITY_NAMES`, `CITY_TIME_ZONES`, `CITY_NOTES`), `WEATHER_LABELS` (30+ entradas), `MODE_LABELS`, mensagens, configs, todo o wiring, todos os event listeners, touch gestures, teclado, rádio, favoritos, tema, fullscreen, Stay22... Repare: existem módulos `radio-controller`, `video-controller`, etc., mas **nenhum teste unitário para o bootstrap** — porque é impossível instanciá-lo fora de um DOM completo.

### Duas fontes de verdade para a mesma coisa
`isStaticLocalPreview` está **duplicado** — definido em `bootstrap.mjs:760` e novamente inline como arrow em `:650`. Dados de país existem em `data/catalog.json`, em `COUNTRY_INFO` no bootstrap, e agora de novo em `city-seo-content.json`. Três lugares para mudar quando uma cidade muda de país.

### Regras CSS duplicadas de propósito
```html
<!-- index.html:136-137 -->
<!-- Regras DUPLICADAS de styles.css de propósito: qualquer edição estética aqui deve espelhar lá. -->
```
O site inteiro depende de um humano lembrar de **espelhar manualmente** o CSS crítico nas duas versões (62KB de HTML + 110KB de CSS). Um esquecimento = tela quebrada sem erro de compilação.

---

## 4. FEATURE QUE SE AUTO-SABOTA

### Flight origin usa geolocation que o próprio header bloqueia
```ini
# _headers:5
Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=()
```
...mas `openFlightOffer` → `resolveFlightOriginQuickly` → `createFlightOriginResolver` → `navigator.geolocation.getCurrentPosition` (`flight-origin.mjs:71`). Com `geolocation=()`, o browser **rejeita imediatamente** a permissão → `finish(null)` → `fromIata` nunca é preenchido. A feature de "detectar aeroporto de origem" **é garantidamente morta em produção**, silenciosamente, e existem testes para ela (`test-flight-origin.mjs` passando porque testam a função isolada, não o ambiente).

### Analytics com `country_code` quase sempre vazio
```js
// src/integrations/analytics.mjs:18
const catalog = global.CATALOG || global.YOUCITY_CATALOG;
```
`CATALOG` / `YOUCITY_CATALOG` **nunca são definidos em `window`** — o catálogo vive no escopo de módulo de `catalog.mjs`. Resultado: `extractCountryCode` cai no fallback `""` na maioria dos eventos, e cada `city_view` em `bootstrap.mjs:866` carrega `countryCode: city.countryCode || ""` sem nunca ter `countryCode` no catálogo. Toda a dimensão geo do analytics é ruído vazio.

---

## 5. PERFORMANCE: esforço real, compras estranhas

O lado bom: GTM atrasado via `requestIdleCallback`, player do YouTube só pós-`load`, catálogo completo lazy, poster `<img>` com `fetchpriority=high`, fontes `display=swap`. Competente.

O lado cruel:
- **40+ arquivos `.mjs` sem bundle, sem minify, sem conteúdo-hash** servidos com `max-age=3600` + SWR. Nenhum sistema de cache-busting versionado; o único "versionamento" é `?v=${YOUCITY_ASSET_VERSION}` num único script. Um deploy em produção pode servir JS de 1h atrás.
- **9MB de PNG de ad commitados** (`assets/ad/`, 8.7MB) que **não são usados** — só se provou com um teste que eles não vão ao build (`build-static.js:185`). Reconheceu o problema e o manteve no repo mesmo assim. Com juros: `assets/blog/` tem 26MB (originais `1.png` + webp 1/640/960/1440), `hero-saopaulo.png` 2.1MB e `logo.png` 1MB — todos mortos no `dist`, todos pesando no clone/deploy.
- SEO: cada `/city/<slug>` gerado embute o app JS completo que **re-renderiza sobre o HTML estático** — se a página estática já tem o conteúdo, por que o SPA precisa sobrescrever? Vale investigar o flash de conteúdo.

---

## 6. AFA/PRIVACIDADE/OUTROS

- `rel="sponsored noopener noreferrer"` em todos os links afiliados (`travel-controller.mjs:77`): bom para SEO/segurança, mas **`noopener noreferrer` corta o referrer** — vários programas afiliados (hotéis) atribuem conversão pelo referrer da landing page. Pode estar **matando comissões** silenciosamente.
- Consent Mode v2: o snippet inline sincrono é correto e a preferência entre banner/settings funciona. Mas o banner não tem **focus trap**, não restaura foco e o modal "privacy" não tranca `aria-hidden` do fundo — a11y de modal amador.
- `?preview=drawer` / `?preview=travel` (QA) exposto em produção (`bootstrap.mjs:1120`): qualquer vendedor pode abrir o drawer de viagens via URL.
- Produto inteiro é inglês, mas comentários `pt-BR` misturados — cosmético.
- `_redirects` só tem aliasing `/index.html`; `/privacy` e `/terms` extensionless não têm alias, e o link do consent aponta direto pro `/privacy.html` com `.html` exposto.

---

## A favor (honestidade cruel)
- Consent Mode v2 sincrono antes do GTM: feito do jeito certo.
- Testes de contrato para padrões de URL/JS são verdadeiros (comment-assistant, radio-browser).
- O esforço de performance explícito (não remover o `<img>` hero para preservar LCP, decisões comentadas) mostra maturidade rara em projeto pessoal.
- Deploy em Pages sem DB é digno de respeito para um catálogo de 206 cidades.

---

## Recomendações, em ordem de prioridade
1. Troque `?role=admin` por algo real ou delete o conceito de admin (hoje é fantasia).
2. Adicione CSP (`default-src 'none'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; frame-src https://www.youtube-nocookie.com https://www.google.com; ...`) — hoje é a única linha de defesa contra XSS.
3. Corrija o conflito `geolocation=()` vs `flight-origin` (tire a feature ou tire o header).
4. Corrija `extractCountryCode` (expor o catálogo em `window` ou passar o city direto).
5. Podem `assets/ad/*`, `assets/blog` originais e `.png` grandes do repo — Git não é CDN.
6. Escreva **um** teste que meça `performance.now()` de boot real, ou pare de chamar regex de "performance test".
7. Elimine a duplicação CSS inline↔styles.css com uma etapa de build que injete o CSS shell.