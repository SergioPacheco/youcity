# Arquitetura após a refatoração

## Entrada e composição

`src/main.mjs` é a entrada nativa do navegador e inicia o bootstrap da aplicação.
O bootstrap compõe os módulos explícitos, sem manter implementações de feature ou
timers de mídia. Não foi introduzido
bundler: o build estático copia os módulos, corrige os caminhos e acrescenta
`ASSET_VERSION` aos imports estáticos e dinâmicos.

## Módulos e contratos

- `src/catalog/catalog-repository.mjs`: normalização, modos disponíveis e seleção de ride.
- `src/core/url.mjs`: parsing e construção de URLs públicas.
- `src/core/video-policy.mjs`: política intencional de início efetivo, com mínimo de 15 s.
- `src/core/storage.mjs` e `src/state/store.mjs`: acesso seguro a storage e estado compartilhado sem handles efêmeros.
- `src/player/youtube-player.mjs` e `src/player/video-controller.mjs`: API do YouTube, player, timeouts, comandos e ciclo de reprodução.
- `src/radio/radio-controller.mjs`: áudio, autoplay, retry, timers e listeners.
- `src/weather/weather-controller.mjs`: cache, AbortController, timeout e proteção contra respostas obsoletas; é inicializado sem bloquear a UI.
- `src/features/map/`: Leaflet, mapa, marcadores, listeners e loader sob demanda.
- `src/features/city-guide/`: consultas, cache, AbortController e renderização do City Guide.
- `src/features/comment-assistant/`: controlador ESM, regras puras, histórico e
  importação deduplicada; todo o Comment Assistant só é carregado ao abrir a ferramenta.
- `src/features/travel/`: CTA, planner, Stay22 e providers secundários, com carregamento progressivo.
- `src/integrations/analytics.mjs`: inicialização explícita do contrato de analytics
  usado pelos módulos de afiliados.
- `src/navigation/`: leitura e sincronização de rota sem depender de funções do bootstrap.
- `src/sharing/`: composição dos dados e destinos de compartilhamento.
- `src/ui/`: DOM cacheado, camadas, navegador de cidades e controles de mídia.
- `src/core/lazy-module.mjs`: contrato testado de deduplicação concorrente e retry após falha.

O store contém apenas dados de aplicação/navegação. Timers, players, mapa,
AbortControllers, cache de serviço e estado transitório dos controladores não são
persistidos nele. Catálogo e configuração do mapa são imports ESM; scripts
clássicos permanecem apenas onde a integração de afiliados exige os namespaces
globais públicos existentes.

## Lazy loading e recuperação

Mapa, City Guide e Comment Assistant possuem fronteiras de `import()` com cache de
Promise e reset após falha. O loader constrói o controlador ESM e a reabertura
reutiliza a instância, sem registrar listeners novamente. A troca de cidade
invalida a requisição corrente do guia e do clima antes de renderizar dados
novos. Falhas opcionais são apresentadas ou registradas sem impedir a
navegação, vídeo e rádio.

`?role=admin` continua sendo somente um controle de interface. Autenticação
administrativa e proteção do endpoint permanecem trabalho separado.

## Limitações conhecidas

- O bootstrap ainda contém a inicialização e o registro dos listeners gerais da página;
  implementações de domínio e recursos com ciclo de vida próprio permanecem nos módulos
  dedicados, sem uma camada de event bus.
- O catálogo continua sendo um único asset gerado a partir de `data/catalog.json`.
- A desambiguação avançada do City Guide, redesenho responsivo, suíte E2E/visual,
  segurança administrativa, SEO editorial e renomeação de analytics não fazem
  parte desta execução.
