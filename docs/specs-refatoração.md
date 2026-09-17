# Prompt — Refatoração arquitetural do YouCity

Atue como engenheiro JavaScript sênior responsável por uma refatoração profunda da arquitetura do repositório:

https://github.com/SergioPacheco/youcity

O objetivo é substituir o `app.js` monolítico por módulos coesos, reduzir o acoplamento e implementar carregamento sob demanda das funcionalidades secundárias, preservando a experiência atual.

A profundidade da refatoração está autorizada. Não transforme isso em uma migração de framework ou em uma arquitetura mais complexa do que o projeto necessita.

## 1. Contexto e comportamentos obrigatórios

O YouCity combina vídeos do YouTube, rádio, navegação entre cidades, mapas, clima, guia turístico, afiliados, compartilhamento, SEO estático e Comment Assistant.

Preserve os comportamentos corretos existentes, especialmente:

* URLs públicas, slugs e parâmetros de cidade, modo e vídeo;
* seleção de cidade e experiência;
* reprodução e recuperação de falhas;
* rádio e restrições de autoplay;
* favoritos e preferências;
* CTAs e links afiliados;
* tracking existente;
* páginas SEO;
* compatibilidade com Cloudflare Pages e os caminhos de publicação suportados.

### Início dos vídeos: decisão intencional

**O mínimo de 15 segundos é um requisito do produto.**

Foi escolhido para pular títulos e introduções indesejáveis. Não é uma regressão e não deve ser removido.

Preserve a regra:

```javascript
const configuredStart = Number(ride?.start);

return Math.max(
  15,
  Number.isFinite(configuredStart) ? configuredStart : 0
);
```

Resultados esperados:

| `ride.start`        | Início efetivo |
| ------------------- | -------------: |
| Ausente ou inválido |    15 segundos |
| 0                   |    15 segundos |
| 8                   |    15 segundos |
| 15                  |    15 segundos |
| 45                  |    45 segundos |

Centralize essa política em uma função testável. Utilize-a consistentemente na criação do player, troca de vídeo e link de origem, conforme os contratos atuais.

Não altere os valores originais do catálogo apenas para aplicar essa política. O catálogo informa o início configurado; a política de reprodução determina o início efetivo.

Não descreva essa regra como mecanismo para evitar anúncios do YouTube.

## 2. Como conduzir o trabalho

Antes de editar:

1. Leia as instruções do repositório, README, package.json, workflows e documentação relevante.
2. Registre o SHA e o estado do worktree.
3. Examine o código atual e os commits relevantes de 16–17/09/2026.
4. Execute os testes, build e validações existentes.
5. Identifique os consumidores e efeitos colaterais do `app.js`.

Use a revisão anterior como lista de investigação, não como verdade imutável. Confirme se cada problema ainda existe.

Classifique os achados como:

* comportamento intencional;
* defeito reproduzido;
* risco sustentado pelo código;
* hipótese que exige validação.

Trabalhe em uma branch específica e preserve alterações existentes do usuário. Não faça deploy, merge ou push sem autorização.

Depois de uma inspeção breve, apresente a arquitetura proposta e a sequência de trabalho e prossiga com a implementação. Pergunte apenas quando houver uma decisão de produto ou acesso realmente bloqueante.

Esta execução está organizada em quatro marcos. Os critérios de aceite de cada marco devem ser satisfeitos antes do avanço, mas não é necessária nova aprovação entre extrações já incluídas neste escopo.

## 3. Arquitetura desejada

Prefira JavaScript com ES Modules. Não introduza framework por conveniência.

Uma estrutura inicial possível é:

```text
src/
  main.js
  state.js
  navigation.js
  catalog.js
  player.js
  radio.js
  weather.js
  sharing.js
  analytics.js

  ui/
    layers.js
    controls.js

  features/
    map/
    city-guide/
    travel/
    comment-assistant/
```

Essa estrutura é uma orientação, não uma lista obrigatória de arquivos.

Crie arquivos internos adicionais quando houver responsabilidades distintas, lógica reutilizada ou necessidade concreta de teste.

### Regras de organização

* `main.js` deve compor e inicializar a aplicação.
* Cada funcionalidade deve possuir uma API pública pequena.
* Declare dependências explicitamente.
* Separe regras de domínio, acesso externo e manipulação do DOM onde isso simplificar o código.
* Evite dependências circulares e efeitos colaterais executados ao importar módulos.
* Evite um objeto global gigante passado para todos os módulos.
* Não crie um diretório `utils` que vire um novo monólito.
* Não adicione camadas vazias de controller/service/repository.
* Não introduza event bus, reducers ou biblioteca de estado sem necessidade demonstrada.

O sucesso será medido pela clareza das responsabilidades e pela preservação do comportamento, não por limites arbitrários de linhas.

## 4. Estado e ciclo de vida

Encapsule o estado compartilhado com operações explícitas.

Distinga:

* estado persistente: preferências, volume, favoritos e cidades recentes;
* estado da navegação: cidade, modo e vídeo;
* estado dos serviços: reprodução, rádio e requisições;
* estado visual: drawers, modais, carregamento e erros.

Mantenha elementos DOM, players, timers e controllers de requisição nos módulos responsáveis por seu ciclo de vida.

Requisitos:

* não duplicar a fonte de verdade;
* tratar storage indisponível e JSON inválido;
* preservar dados já salvos;
* remover listeners, timers e observadores quando necessário;
* inicialização idempotente;
* abertura repetida de uma funcionalidade sem efeitos duplicados;
* respostas antigas não podem sobrescrever a cidade atual.

Verifique especialmente o seguinte cenário:

1. Abrir o guia da cidade A, ainda sem cache.
2. Mudar para a cidade B.
3. Abrir B, já em cache.
4. A resposta de A chegar depois.

O conteúdo de A não pode substituir B. Invalide requisições anteriores também quando a nova navegação usa cache.

## 5. Lazy loading e performance

Carregue no início o necessário para a primeira experiência útil: cidade, navegação essencial, vídeo, rádio e controles visíveis.

### Carregar sob demanda

* Mapa e Leaflet: ao abrir o mapa.
* City Guide: ao abrir o guia.
* Comment Assistant: ao abrir a ferramenta, respeitando seu modelo de acesso.
* Recursos pesados do planejador: quando forem necessários.

### Não prejudicar funcionalidades visíveis

* CTAs inicialmente visíveis devem continuar funcionais.
* Não atrase links afiliados apenas para reduzir artificialmente o bundle inicial.
* Clima pode carregar após a renderização essencial, sem depender de interação.
* Divida compartilhamento somente se houver benefício mensurável.

### Requisitos técnicos

* deduplicar carregamentos simultâneos;
* apresentar loading e erro acessíveis;
* oferecer recuperação de falha;
* não duplicar listeners;
* não carregar dependências pesadas por um import estático indireto;
* garantir caminhos corretos em deep links e base paths;
* manter a aplicação principal utilizável se um módulo opcional falhar.

### Build e cache dos módulos

Verifique o grafo completo de imports, incluindo imports dinâmicos.

Não considere suficiente versionar apenas `main.js` com query string: isso não versiona automaticamente suas dependências.

Escolha uma estratégia consistente, como assets com hash de conteúdo, e justifique a ferramenta de build usada. Um bundler leve pode ser adotado se resolver concretamente code splitting, caminhos e versionamento.

Valide:

* todos os chunks publicados;
* MIME correto;
* imports funcionando em `/city/<slug>`;
* caminhos em GitHub Pages, se esse deployment continuar suportado;
* comportamento de uma aba antiga após novo deploy;
* falhas de chunk com recuperação controlada, sem loop de reload.

## 6. Preservação dos contratos

Antes de extrair código, documente os contratos que podem quebrar:

* URL e histórico;
* seletores DOM essenciais;
* dados persistidos;
* catálogo;
* callbacks do YouTube;
* estados do rádio;
* providers e links afiliados;
* eventos enviados ao Tag Manager/PostHog;
* APIs das Pages Functions;
* build e SEO.

Mantenha adaptadores temporários quando necessário, mas remova-os ao concluir a migração.

Não mantenha duas implementações permanentes do mesmo fluxo.

## 7. Catálogo

Preserve `data/catalog.json` como fonte canônica.

Verifique:

* cidades e países;
* coordenadas;
* modos;
* IDs dos vídeos;
* tempos configurados;
* títulos;
* rádios;
* URLs;
* timezone, quando disponível.

Adicione validação proporcional ao contrato real. Não torne campos opcionais obrigatórios sem verificar os consumidores e os dados atuais.

Compare semanticamente o catálogo antes e depois:

* registros adicionados/removidos;
* vídeos alterados;
* rádios alteradas;
* coordenadas;
* títulos;
* tempos de início.

Contagem igual não prova preservação dos dados.

Garanta que build, SEO e runtime consumam interpretações compatíveis do catálogo. Evite normalização diferente no navegador e nos scripts.

## 8. Clima e guia da cidade

Extraia clientes HTTP e apresentação para limites claros.

Compartilhe lógica entre cliente e servidor somente quando a lógica for realmente comum e independente do ambiente. Não envie código ou segredos do servidor ao navegador.

### Clima

Verifique e teste:

* ausência de latitude/longitude;
* strings vazias;
* zero como coordenada válida;
* limites e valores inválidos;
* timeout e cancelamento;
* 429 e 5xx;
* JSON inválido;
* resposta sem os campos necessários;
* cache e expiração;
* troca rápida de cidade;
* atualização de informação que ficou antiga em uma sessão longa.

Não transforme automaticamente valores ausentes em zero por meio de `Number(null)` ou `Number("")`.

### City Guide

Verifique:

* cidades homônimas;
* correspondência de país e coordenadas;
* resultado ambíguo;
* falha parcial de provedores;
* timeout total da operação;
* cache de respostas incompletas;
* links de Wikipedia no idioma correto;
* URLs e conteúdo externo seguros;
* fontes e atribuições das imagens.

Não use automaticamente o primeiro resultado de busca como confirmação da cidade.

Prefira resultado validado ou ausência explícita de conteúdo a apresentar um guia de outra cidade.

O guia indisponível não pode impedir o acesso às ofertas de viagem.

## 9. Comment Assistant

`?role=admin` pode controlar visibilidade da interface, mas não representa autorização.

Inspecione o uso real antes de implementar infraestrutura de autenticação.

* Se for apenas uma ferramenta auxiliar sem operações privilegiadas, documente claramente esse limite.
* A autenticação administrativa e mudanças no modelo de segurança dos endpoints estão fora desta refatoração. Preserve o comportamento atual e documente que `?role=admin` controla somente a interface.
* Proteja o consumo de quota da YouTube API conforme o modelo escolhido.
* Nunca exponha a chave da API no cliente.
* Não apresente rate limiting em memória como garantia distribuída entre instâncias serverless.

Corrija problemas reproduzidos nos fluxos de:

* análise;
* identificação de cidade;
* seleção de modo, incluindo Beach Walk;
* geração;
* edição;
* cópia;
* aprovação;
* histórico;
* compartilhamento.

Um comentário de outro vídeo não deve substituir silenciosamente o texto de compartilhamento atual.

## 10. Analytics e afiliados

Mapeie os eventos existentes antes de modificá-los.

Preserve nomes e payloads utilizados pelo Tag Manager/PostHog, salvo mudança justificada com estratégia de compatibilidade.

Diferencie semanticamente:

* abertura do guia;
* abertura do planejador;
* impressão de oferta;
* clique afiliado.

Não registre automaticamente toda abertura do guia como intenção de compra.

Evite eventos duplicados após montagem, reabertura ou lazy loading.

Falhas de analytics não podem interromper a aplicação.

## 11. Interface responsiva e acessibilidade

Preserve a aparência atual, corrigindo problemas reproduzidos.

A existência de regras CSS sobrepostas não prova um bug. Verifique o comportamento calculado e a intenção antes de removê-las.

Organize CSS por responsabilidade quando isso facilitar a manutenção. Evite uma reestruturação puramente estética.

Teste pelo menos:

* 320 × 568;
* 390 × 844;
* desktop 1366 × 768;
* landscape mobile;
* touch e teclado.

Amplie a matriz quando houver um breakpoint ou problema concreto a investigar.

Fluxos essenciais:

* topbar e Explore;
* cidade e clima;
* rádio compacto/expandido;
* modos;
* próxima cidade;
* drawer de cidades;
* mapa;
* guia e ofertas;
* compartilhamento;
* Comment Assistant.

Verifique foco, Escape, conteúdo oculto fora da navegação por teclado, rolagem dos drawers e ausência de elementos sobrepostos que impeçam interação.

## 12. SEO

Preserve a geração estática de:

* home;
* páginas de cidade;
* canonical;
* sitemap;
* robots;
* JSON-LD;
* Open Graph;
* Twitter Cards;
* página 404.

Remova referências obsoletas do builder e teste substituições obrigatórias.

Verifique o impacto real da regra:

```text
Disallow: /*?*
```

Ela pode alcançar tanto URLs de navegação quanto recursos versionados com query string. Avalie se recursos necessários à renderização ficam bloqueados para crawlers.

Não remova a regra indiscriminadamente. Ajuste com base nos recursos e URLs efetivamente gerados.

Teste o sitemap com uma fixture contendo cidade sem vídeo.

Não invente datas para `lastmod`.

Pré-renderização de conteúdo editorial do guia é uma melhoria separada: avalie e documente, mas não transforme a refatoração em um projeto de conteúdo ou em build dependente de APIs externas instáveis.

## 13. Testes e baseline

Execute os comandos atuais e registre resultados antes de alterar o código.

Adicione testes que protejam comportamentos e contratos, evitando testes que apenas repitam a implementação.

### Prioridades de teste

1. Política intencional de início mínimo em 15 segundos.
2. Deep links e back/forward.
3. Troca de cidade, modo e vídeo.
4. Rádio, autoplay bloqueado e gesto do usuário.
5. Respostas assíncronas obsoletas.
6. Catálogo preservado.
7. Clima e guia em sucesso, erro e timeout.
8. Lazy loading e reabertura sem listeners duplicados.
9. CTAs e tracking.
10. Build, chunks e SEO.

Use mocks determinísticos para YouTube, rádio e APIs externas.

Faça smoke tests reais separados, sem alegar que mocks comprovam disponibilidade dos provedores ou todas as políticas de autoplay dos navegadores.

Faça somente os smoke checks de interface necessários para os fluxos críticos. Uma suíte visual abrangente, screenshots de regressão e a matriz completa de dispositivos ficam fora desta execução.

## 14. Quatro marcos de implementação

### Marco 1 — Baseline e testes essenciais

Preserve a alteração existente neste arquivo. Registre SHA, estado do worktree, testes, builds, SEO e métricas disponíveis. Mapeie responsabilidades, estado e contratos públicos. Adicione testes focados em início efetivo dos vídeos, URL, seleção de cidade/modo e respostas assíncronas obsoletas.

Use a infraestrutura existente sempre que possível. Não transforme este marco em um projeto completo de Playwright, screenshots, Lighthouse ou cobertura percentual.

Aceite: baseline reproduzível e proteção mínima dos comportamentos que serão extraídos.

### Marco 2 — Extração do núcleo

Extraia catálogo, estado, URL, cidade, player e rádio. Defina APIs pequenas e dependências explícitas. Evite event bus e camadas extras sem necessidade concreta. Preserve URLs, storage, analytics e a política dos 15 segundos. Mantenha a aplicação executável durante a migração e teste os contratos de cada extração.

Aceite: o núcleo deixa de depender das funções internas do monólito; navegação, vídeo e rádio continuam funcionando.

### Marco 3 — Carregamento sob demanda

Implemente lazy loading para mapa, City Guide, Comment Assistant e partes secundárias do planejador que não sustentam CTAs inicialmente visíveis. O clima continua disponível na interface inicial, com carregamento não bloqueante, e não depende da abertura de painel.

Garanta imports concorrentes deduplicados, erro e nova tentativa, reabertura sem listeners duplicados, base path, deep links, versionamento consistente e funcionamento usando o artefato gerado pelo build. Para Leaflet, preserve ou adapte o loader de vendor caso seja mais simples que importá-lo como módulo.

Aceite: funcionalidades secundárias deixam de carregar inicialmente e continuam funcionando quando abertas.

### Marco 4 — Remoção do legado e validação final

Remova adaptadores temporários, código morto e imports obsoletos. Execute testes e builds normal e com base path. Verifique os fluxos principais em desktop, mobile e landscape. Compare as métricas com o baseline e documente arquitetura, limitações e rollback.

Aceite: monólito substituído, contratos preservados e resultados apresentados com evidência.

### Trabalhos separados

Registre, mas não implemente automaticamente neste escopo:

* autenticação administrativa;
* mudanças no modelo de segurança dos endpoints;
* desambiguação avançada do City Guide;
* estratégia editorial e expansão de SEO;
* redesign responsivo;
* renomeação de eventos de analytics;
* suíte E2E e visual abrangente;
* divisão do catálogo em arquivos por cidade.

Defeitos encontrados durante a extração devem ser documentados. Corrija nesta execução apenas os necessários para concluir a migração corretamente, em alterações separáveis e acompanhadas de teste.

Cada etapa deve deixar o projeto executável.

Use commits coerentes e reversíveis. Não faça um único commit misturando toda a extração com mudanças funcionais.

## 15. Critérios de conclusão

A refatoração estará concluída quando:

* o `app.js` deixar de concentrar as funcionalidades;
* o bootstrap apenas compuser a aplicação;
* os módulos tiverem responsabilidade e API claras;
* não existirem dependências circulares;
* mapa, guia e assistente forem carregados sob demanda;
* a regra dos 15 segundos estiver preservada e testada;
* catálogo e dados persistidos estiverem preservados;
* URLs e histórico continuarem funcionando;
* CTAs visíveis continuarem utilizáveis;
* analytics não tiver alterações silenciosas;
* clima e guia não exibirem resultados de cidades anteriores;
* mobile, desktop e landscape passarem pelos smoke checks dos fluxos críticos;
* testes, build e SEO passarem;
* os módulos dinâmicos funcionarem no artefato publicado;
* o legado temporário tiver sido removido;
* houver comparação antes/depois e instruções de rollback.

Não imponha metas arbitrárias de linhas, quantidade de arquivos ou porcentagem de redução.

Meça bytes transferidos, JavaScript inicial, requests e tempo até a experiência útil em condições comparáveis. Defina expectativas com base no baseline e explique os ganhos e eventuais custos.

## 16. Entrega final

Apresente:

1. Arquitetura implementada.
2. Responsabilidades dos módulos.
3. Funcionalidades com lazy loading e seus gatilhos.
4. Contratos preservados.
5. Defeitos reproduzidos e corrigidos.
6. Comandos de validação e resultados.
7. Comparação de performance.
8. Limitações ainda existentes.
9. Procedimento de rollback.

Não declare resultado que não tenha sido verificado.

A prioridade é reduzir o custo e o risco das próximas mudanças no YouCity, mantendo a experiência de assistir às cidades, ouvir rádio e explorar destinos.
