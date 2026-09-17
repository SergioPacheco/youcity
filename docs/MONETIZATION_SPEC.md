# YouCity — Monetização de viagens

Especificação e backlog para adicionar monetização ao YouCity mantendo o
projeto estático, sem backend e sem banco de dados.

> A implementação atual usa o Affiliate Engine modular documentado em
> [`docs/affiliate-architecture.md`](affiliate-architecture.md). O namespace
> público atual é `YOUCITY_AFFILIATE_CONFIG`; novos providers devem ser
> adicionados em `affiliate/`.

## 1. Objetivo

Transformar cada página `/city/<slug>` em uma experiência de descoberta e
planejamento:

```text
descobrir a cidade → explorar → planejar → reservar
```

A primeira versão terá quatro categorias visíveis:

1. Viator — experiências e tours;
2. Booking.com ou Expedia — hotéis;
3. DiscoverCars — aluguel de carros;
4. Airalo — eSIM.

Travelpayouts será a rede geral e a camada de distribuição para as verticais
que forem aprovadas. Seguro e voos ficarão em opções secundárias até haver
dados suficientes. Skyscanner só entra depois que o YouCity atingir o requisito
de tráfego do programa.

## 2. Restrições arquiteturais

- O site continua sendo estático.
- Não haverá API própria ou banco de dados nesta fase.
- Links afiliados serão diretos inicialmente.
- Widgets, pixels e scripts de terceiros não serão usados na primeira versão.
- A configuração será compartilhada pelo app e pelo build estático.
- Nenhum card será exibido sem uma URL válida e aprovada.
- Toda oferta afiliada deverá usar `rel="sponsored noopener noreferrer"`.

## 3. Ordem de ativação

Os cadastros podem ser feitos em paralelo, mas a ativação técnica deve seguir
esta ordem:

| Ordem | Produto | Programa | Exposição inicial |
| --- | --- | --- | --- |
| 0 | Fundação | — | Configuração, disclosure, validação e tracking |
| 1 | Experiências | Viator | Card principal em cidades piloto |
| 2 | Hotéis | Booking/CJ, Expedia ou Travelpayouts | Um provider por teste |
| 3 | Aluguel de carro | DiscoverCars | Prioridade por destino |
| 4 | eSIM | Airalo | Card para viajantes internacionais |
| 5 | Seguro | Heymondo | `More travel options` |
| 6 | Voos | Travelpayouts | `More travel options` |
| 7 | Voos | Skyscanner | Somente após 5.000+ usuários únicos/mês |

## 4. Modelo de configuração

O contrato novo deve substituir gradualmente o placeholder atual de
`affiliate/affiliate-config.js`. A aplicação deve usar um único namespace:

```js
window.YOUCITY_TRAVEL = {
  version: 1,

  disclosure: {
    short: "Some travel links are affiliate links. YouCity may earn a commission at no additional cost to you.",
    path: "/affiliate-disclosure"
  },

  providers: {
    viator: {
      category: "experiences",
      label: "Things to do",
      network: "direct",
      active: false,
      linkStrategy: "explicit"
    },
    travelpayouts: {
      category: "network",
      label: "Travel options",
      network: "travelpayouts",
      active: false
    },
    booking: {
      category: "hotels",
      label: "Stay",
      network: "cj",
      active: false
    },
    expedia: {
      category: "hotels",
      label: "Stay",
      network: "direct",
      active: false
    },
    discovercars: {
      category: "cars",
      label: "Get around",
      network: "direct",
      active: false
    },
    airalo: {
      category: "esim",
      label: "Stay connected",
      network: "direct",
      active: false
    },
    heymondo: {
      category: "insurance",
      label: "Travel protected",
      network: "direct",
      active: false
    },
    skyscanner: {
      category: "flights",
      label: "Flights",
      network: "direct",
      active: false,
      minMonthlyUniqueVisitors: 5000
    }
  },

  defaults: {
    categories: {}
  },

  byCountry: {},
  byCity: {}
};
```

Cada oferta resolvida deverá possuir, no mínimo:

```js
{
  provider: "viator",
  category: "experiences",
  city: "barcelona",
  label: "Tours & experiences in Barcelona",
  url: "https://provider.example/approved-deep-link",
  campaign: "barcelona-city-page",
  placement: "city-plan-trip",
  priority: 1,
  active: true
}
```

### Regras do modelo

- `byCity` será indexado por slug estável, não pelo nome exibido.
- Defaults por país e por categoria evitam criar 179 × 5 registros manuais.
- A oferta da cidade sobrescreve a oferta do país.
- `active: false` significa que o provider não aparece na interface.
- `priority` determina a ordem dos cards.
- `campaign` e `placement` são obrigatórios para medir desempenho.
- URLs explícitas são preferíveis; templates só serão usados quando o programa
  garantir que o destino gerado é correto.
- Cada provider poderá possuir `destinationId` ou `destinationSlug` quando o
  programa não aceitar um nome de cidade simples.

## 5. Resolução de ofertas

Criar uma função compartilhada conceitualmente equivalente a:

```text
resolveCityTravel(city)
        ↓
provider defaults
        ↓
category defaults
        ↓
country overrides
        ↓
city overrides
        ↓
active + valid + sorted offers
```

Essa função deve ser usada por:

- página principal da cidade;
- popup/diretório do mapa;
- fallback sem JavaScript;
- build estático;
- testes e validação.

O resolvedor nunca deve retornar uma oferta com URL inválida, provider
desativado ou cidade inexistente.

## 6. Interface

Adicionar um bloco principal de planejamento, fora do popup do mapa:

```text
PLAN YOUR TRIP TO [CITY]

Stay
Find hotels in [CITY]

Things to do
Tours & experiences in [CITY]

Get around
Compare car rentals

Stay connected
Get an eSIM

Affiliate disclosure: ...
```

Regras de apresentação:

- máximo de quatro cards na primeira versão;
- experiências devem ter maior destaque;
- carros podem ter prioridade menor ou ser omitidos por cidade;
- seguro e voos ficam em `More travel options`;
- card sem oferta resolvida não aparece;
- todos os cards precisam funcionar em mobile, teclado e leitor de tela;
- não usar iframe ou widget na primeira versão.

O mapa deve consumir o mesmo resultado do resolvedor, mas não deve ser o local
principal da monetização.

## 7. Tracking e métricas

Criar um adaptador de analytics desacoplado do provider. O evento mínimo é:

```js
{
  event: "affiliate_click",
  city: "granada",
  country: "Spain",
  provider: "viator",
  category: "experiences",
  placement: "city-plan-trip",
  mode: "drive",
  campaign: "granada-city-page"
}
```

Não enviar nome, e-mail, IP armazenado pela aplicação ou qualquer dado
pessoal. O tracking precisa funcionar mesmo quando analytics estiver
desabilitado, sem impedir o link de abrir.

Métricas de decisão:

- CTR por cidade e categoria;
- cliques qualificados;
- receita por clique (EPC);
- receita por mil visualizações;
- conversões informadas pelo programa;
- taxa de links inválidos;
- desempenho por `placement` e `campaign`.

Os sub-IDs oferecidos por Travelpayouts e pelos programas diretos devem usar
cidade, categoria e campanha quando os termos do programa permitirem.

## 8. SEO, disclosure e privacidade

O build deve gerar o bloco de planejamento no HTML das páginas de cidade, não
apenas via JavaScript. O fallback sem JavaScript também deve conter os links
válidos e a divulgação.

Antes de escalar para as 179 cidades, cada página deve evoluir gradualmente
com conteúdo original, como:

- melhor época para visitar;
- aeroporto e chegada;
- transporte local;
- bairros;
- atrações relevantes;
- relação com os modos Drive, Walk, Bike e Drone disponíveis.

Criar `/affiliate-disclosure` e incluir um link acessível no rodapé ou na área
de informações. A documentação e o texto da interface não podem continuar
afirmando que não existe coleta de dados depois que analytics remoto for
ativado. O armazenamento local de preferências e estatísticas deve ser
descrito separadamente de analytics de afiliados.

## 9. Validação técnica

Expandir `scripts/seo-check.js` para verificar:

- schema válido de `affiliate/affiliate-config.js`;
- providers ativos com URLs válidas;
- ausência de `javascript:` e `data:`;
- `rel="sponsored"` em todos os links afiliados;
- disclosure presente;
- nenhuma cidade com card vazio;
- URLs de cidade sem duplicidade;
- presença do planner no HTML estático;
- cobertura das 179 páginas;
- funcionamento do fallback sem JavaScript.

Adicionar testes do resolvedor para:

- provider default;
- override por país;
- override por cidade;
- provider desativado;
- prioridade;
- cidade sem oferta;
- URL inválida;
- destino específico por provider.

Comandos de validação esperados:

```bash
SEO_SITE_URL=https://your-domain.example node scripts/build-static.js
node scripts/seo-check.js
```

## 10. Cadastro e operação dos programas

### Travelpayouts

- criar conta e Project do YouCity;
- obter Partner ID;
- identificar programas de hotéis, voos, tours, seguros e carros;
- registrar quais programas foram aprovados;
- documentar regras de deep link, sub-ID, cookie e divulgação;
- começar usando-o como rede, não como novo card genérico.

### Viator

- solicitar aprovação no programa direto;
- obter deep links para cidades e atrações;
- montar piloto com cidades de perfis diferentes;
- ativar experiências como primeiro card;
- acompanhar CTR e receita por cidade.

### Hotéis

- solicitar Expedia Travel Creator;
- solicitar Booking via CJ;
- comparar também ofertas disponíveis em Travelpayouts;
- ativar somente um provider padrão por experimento;
- escolher pelo EPC e conversão, não apenas pela taxa nominal.

### DiscoverCars

- obter links/deep-link generator;
- criar regras de prioridade por país/cidade;
- validar destinos onde carro é relevante;
- acompanhar cliques e reservas.

### Airalo

- obter link de afiliado e regras de destino;
- configurar defaults por país;
- testar como card complementar de conversão simples.

### Heymondo

- solicitar condições comerciais;
- registrar comissão e janela de atribuição após aprovação;
- manter em `More travel options` inicialmente.

### Skyscanner

Não implementar ainda. Criar somente uma tarefa bloqueada por requisito de
tráfego e reavaliar quando o YouCity ultrapassar 5.000 usuários únicos/mês.

## 11. Backlog executável

### Fase 0 — fundação

- [ ] `MON-001` Definir e documentar o schema `YOUCITY_TRAVEL`.
- [ ] `MON-002` Adicionar IDs/slugs estáveis às cidades.
- [ ] `MON-003` Migrar o placeholder atual mantendo compatibilidade temporária.
- [ ] `MON-004` Criar o resolvedor de ofertas por categoria, país e cidade.
- [ ] `MON-005` Criar validação de URL e provider.
- [ ] `MON-006` Criar o componente principal `Plan your trip`.
- [ ] `MON-007` Fazer o mapa consumir o resolvedor compartilhado.
- [ ] `MON-008` Criar tracking de `affiliate_click` com adapter desacoplado.
- [ ] `MON-009` Criar `/affiliate-disclosure`.
- [ ] `MON-010` Adicionar planner e disclosure ao HTML gerado pelo build.
- [ ] `MON-011` Expandir `seo-check.js` com validações de monetização.
- [ ] `MON-012` Atualizar README e docs sobre privacidade e monetização.

### Fase 1 — Travelpayouts como base geral

- [ ] `TP-001` Criar conta e Project do YouCity.
- [ ] `TP-002` Registrar Partner ID e regras de sub-ID em documentação privada de operação.
- [ ] `TP-003` Mapear programas aprovados e categorias disponíveis.
- [ ] `TP-004` Definir padrão de campanha por cidade, categoria e placement.
- [ ] `TP-005` Adicionar providers aprovados ao config, inicialmente inativos.
- [ ] `TP-006` Confirmar termos de deep link, disclosure e atribuição.

### Fase 2 — Viator

- [ ] `VIA-001` Criar conta/aprovação no programa da Viator.
- [ ] `VIA-002` Definir cidades piloto.
- [ ] `VIA-003` Cadastrar deep links e aliases de destino.
- [ ] `VIA-004` Ativar `experiences` no planner.
- [ ] `VIA-005` Validar links, tracking e disclosure em desktop e mobile.
- [ ] `VIA-006` Medir CTR, EPC e conversão antes de expandir para as 179 cidades.

### Fase 3 — hotéis

- [ ] `HOT-001` Solicitar Expedia Travel Creator.
- [ ] `HOT-002` Solicitar Booking/CJ.
- [ ] `HOT-003` Mapear ofertas equivalentes no Travelpayouts.
- [ ] `HOT-004` Implementar teste de provider de hotéis.
- [ ] `HOT-005` Escolher o provider padrão com base em dados.

### Fase 4 — DiscoverCars

- [ ] `CAR-001` Solicitar aprovação no DiscoverCars.
- [ ] `CAR-002` Criar regras de prioridade por destino.
- [ ] `CAR-003` Ativar `cars` apenas onde houver oferta válida.
- [ ] `CAR-004` Medir desempenho por cidade e tipo de destino.

### Fase 5 — Airalo

- [ ] `SIM-001` Solicitar aprovação no Airalo.
- [ ] `SIM-002` Definir links por país e overrides necessários.
- [ ] `SIM-003` Ativar `esim` no planner.
- [ ] `SIM-004` Medir CTR e receita complementar.

### Fase 6 — conteúdo e otimização SEO

- [ ] `SEO-001` Criar fonte compartilhada para conteúdo específico de cidade.
- [ ] `SEO-002` Enriquecer primeiro as cidades piloto.
- [ ] `SEO-003` Atualizar title, description e JSON-LD quando houver conteúdo suficiente.
- [ ] `SEO-004` Expandir conteúdo somente após validar qualidade e manutenção.

### Fase 7 — seguro, voos e Worker

- [ ] `INS-001` Solicitar Heymondo e registrar condições aprovadas.
- [ ] `FLT-001` Ativar voos via Travelpayouts em `More travel options`.
- [ ] `FLT-002` Reavaliar Skyscanner após atingir 5.000+ usuários únicos/mês.
- [ ] `WRK-001` Definir requisitos de `/go/<provider>/<city>`.
- [ ] `WRK-002` Implementar Worker somente quando o volume justificar tracking server-side.

## 12. Definition of Done da primeira entrega

A primeira entrega será considerada pronta quando:

- o schema novo estiver validado;
- o resolvedor funcionar para defaults, país e cidade;
- Viator estiver ativo em cidades piloto;
- o planner aparecer na página principal e no HTML estático;
- Booking/Expedia, DiscoverCars e Airalo estiverem preparados, mas só ativos
  quando houver links aprovados;
- todos os links usarem `rel="sponsored"`;
- o disclosure estiver publicado;
- cliques puderem ser segmentados por cidade, provider, categoria e placement;
- `build-static.js` e `seo-check.js` passarem;
- nenhuma página exibir oferta vazia ou destino incorreto;
- o site continuar funcionando sem backend.
