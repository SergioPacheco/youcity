# Future integrations

Roadmap enxuta de integrações que podem ampliar o YouCity sem transformar a
experiência em um catálogo de serviços externos. O projeto permanece
prioritariamente estático, sem login ou banco de dados; cada integração deve
ter um caso de uso claro, fallback e impacto mensurável.

## Já implementado

Estas integrações não são futuras. Elas já fazem parte do produto atual:

| Função | Serviço | Documentação oficial |
| --- | --- | --- |
| 📻 Rádios, música atual e videoclipes | **Radio Browser + YouTube Data API** | [Radio Browser API](https://docs.radio-browser.info/) · [YouTube Search](https://developers.google.com/youtube/v3/docs/search/list) |
| 🌤️ Clima | **Open-Meteo API** | [Open-Meteo API Docs](https://open-meteo.com/en/docs) |
| 🗺️ Mapas | **Leaflet + OpenStreetMap** | [Leaflet](https://leafletjs.com/) |
| 🏛️ Pontos turísticos | **Wikidata API** | [Wikidata API](https://www.wikidata.org/w/api.php) |
| 📚 Informações sobre lugares | **Wikipedia API** | [Wikipedia API](https://www.mediawiki.org/wiki/API:Main_page) |
| 📸 Fotos de lugares | **Wikimedia Commons API** | [Wikimedia Commons API](https://commons.wikimedia.org/w/api.php) |

## Próximas integrações recomendadas

| Prioridade | Função | Serviço | Caso de uso |
| --- | --- | --- | --- |
| P0 | 📧 Newsletter | **Brevo** | Enviar novos destinos e seleções editoriais depois que existir uma cadência de conteúdo. |
| P0 | 📨 Feedback e catálogo | **Tally** | Receber denúncias de vídeos quebrados e sugestões de cidades sem criar um sistema de contas. |
| P0 | 🤖 Proteção de formulários | **Cloudflare Turnstile** | Adicionar somente aos formulários públicos que realmente receberem abuso. |
| P0 | 🚨 Monitoramento | **UptimeRobot** | Monitorar homepage, páginas SEO e endpoints críticos das Pages Functions. |
| P1 | 🚲 Rotas contextuais | **OpenRouteService** | Mostrar rotas úteis dentro do City Guide, quando os lugares tiverem coordenadas confiáveis. |
| P1 | 💱 Conversão de moedas | **Frankfurter API** | Apoiar um planejador de viagem real, caso o produto passe a exibir orçamentos. |

Brevo e Tally não precisam ser usados juntos em todos os fluxos: Brevo é a
opção para relacionamento por e-mail; Tally é a opção rápida para coleta de
feedback. Nenhuma chave privada deve aparecer no frontend.

## Adiado

### PostHog

Não adicionar PostHog antes de explorar o analytics atual. Primeiro devemos
consolidar eventos e responder perguntas de produto com o contrato existente:

- início, término e erro de vídeo;
- troca e seleção de cidade;
- abertura do City Guide;
- clique em atrações;
- impressões e cliques de afiliados;
- início de busca de hospedagem, atividades, carros e voos.

PostHog só deve entrar se o analytics atual não for suficiente para medir
retenção, funil por destino e conversão. Uma nova ferramenta não corrige uma
taxonomia de eventos ruim.

## Geografia, conteúdo e utilidades

| Função | Serviço | Decisão |
| --- | --- | --- |
| 🌍 Países, bandeiras, população | **REST Countries** | Usar somente em scripts de build se surgir necessidade de validação do catálogo. |
| 📍 Geocoding cidade → coordenadas | **Nominatim / OpenStreetMap** | Usar somente offline/no build; não fazer autocomplete agressivo no frontend. |
| 💱 Conversão de moedas | **Frankfurter API** | [Frankfurter Docs](https://frankfurter.dev/docs/) |
| 🚲 Rotas e navegação | **OpenRouteService** | [OpenRouteService](https://openrouteservice.org/dev/#/api-docs) |

O catálogo já é a fonte de verdade para cidades, coordenadas e fusos. Não
adicionar consultas em runtime para dados que já estão disponíveis localmente.

## Diretrizes para futuras integrações

- Priorizar integrações que funcionem bem com a arquitetura estática e Cloudflare
  Pages já utilizada pelo projeto.
- Manter cada serviço isolado em um módulo ou service próprio, evitando chamadas
  espalhadas pelos componentes da interface.
- Nunca expor API keys, tokens OAuth ou secrets no frontend quando o serviço
  exigir credenciais privadas.
- Reutilizar o sistema de analytics existente antes de adicionar uma nova
  ferramenta de métricas.
- Avaliar limites de uso, custos, privacidade, LGPD e necessidade de fallback
  antes de colocar qualquer serviço em produção.
- Respeitar as políticas de uso dos serviços públicos. Em especial, Nominatim
  exige identificação adequada das requisições, limitação de frequência e
  cache; não deve ser usado para autocomplete agressivo no frontend.
- Registrar variáveis de ambiente e o procedimento de configuração na
  documentação da integração correspondente.

Também priorizar a qualidade do catálogo e a receita já existente antes de
adicionar novos fornecedores:

- validar automaticamente vídeos removidos, privados ou não incorporáveis;
- permitir reportar vídeo quebrado e sugerir destinos;
- monitorar páginas SEO e Pages Functions;
- medir conversão por cidade, vertical, placement e provider;
- manter Stay22 e DiscoverCars como integrações comerciais prioritárias.

## Ordem de avaliação

1. Qualidade automática do catálogo e relatório de vídeos quebrados.
2. Monitoramento de páginas e Pages Functions.
3. Newsletter com Brevo, quando houver cadência editorial.
4. Feedback com Tally, se o fluxo não for implementado diretamente em uma Pages Function.
5. Turnstile, somente junto de endpoints públicos sujeitos a abuso.
6. OpenRouteService, para rotas contextuais no City Guide.
7. Frankfurter, quando existir um planejador com orçamento.
8. PostHog somente após provar que o analytics existente é insuficiente.
