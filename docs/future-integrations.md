# Future integrations

Lista de serviços avaliados para possíveis funcionalidades futuras do YouCity.
Os links abaixo apontam para a documentação oficial de cada serviço.

| Função | Serviço | Documentação oficial |
| --- | --- | --- |
| 📻 Rádios, música atual e videoclipes | **Radio Browser + YouTube Data API** | [Radio Browser API](https://docs.radio-browser.info/) · [YouTube Search](https://developers.google.com/youtube/v3/docs/search/list) |
| 🌤️ Clima | **Open-Meteo API** | [Open-Meteo API Docs](https://open-meteo.com/en/docs?utm_source=chatgpt.com) |
| 🔎 Busca de cidades/conteúdo | **Algolia** | [Algolia API Docs](https://www.algolia.com/doc/libraries/sdk?utm_source=chatgpt.com) |
| 🔔 Push notifications | **OneSignal** | [OneSignal Developers](https://documentation.onesignal.com/docs/developers?utm_source=chatgpt.com) |
| 📧 Newsletter / e-mail marketing | **Brevo** | [Brevo API Docs](https://developers.brevo.com/?utm_source=chatgpt.com) |
| 📨 Formulários | **Tally API** | [Tally API Docs](https://developers.tally.so/api-reference/introduction?utm_source=chatgpt.com) |
| ✉️ E-mail pelo frontend | **EmailJS** | [EmailJS Docs](https://www.emailjs.com/docs/?utm_source=chatgpt.com) |
| 💬 Chat online | **Crisp** | [Crisp REST API](https://docs.crisp.chat/guides/rest-api/?utm_source=chatgpt.com) |
| 💬 Comentários | **Giscus** | [Giscus](https://giscus.app/?utm_source=chatgpt.com) |
| 🤖 Anti-spam / CAPTCHA | **Cloudflare Turnstile** | [Cloudflare Turnstile API](https://developers.cloudflare.com/turnstile/?utm_source=chatgpt.com) |
| 🚨 Monitorar se o site caiu | **UptimeRobot API** | [UptimeRobot API](https://uptimerobot.com/api/?utm_source=chatgpt.com) |
| 📊 Analytics / comportamento | **PostHog** | [PostHog](https://posthog.com/?utm_source=chatgpt.com) |

## Geografia, conteúdo e utilidades

| Função | Serviço | Documentação oficial |
| --- | --- | --- |
| 🌍 Países, bandeiras, população | **REST Countries** | [REST Countries Docs](https://restcountries.com/docs) |
| 📍 Geocoding cidade → coordenadas | **Nominatim / OpenStreetMap** | [Nominatim API](https://nominatim.org/release-docs/latest/api/Overview/) |
| 🗺️ Mapas | **Leaflet + OpenStreetMap** | [Leaflet](https://leafletjs.com/) |
| 🕐 Horário/local timezone | **WorldTimeAPI** | [WorldTimeAPI](https://worldtimeapi.org/) |
| 🏛️ Pontos turísticos | **Wikidata API** | [Wikidata API](https://www.wikidata.org/w/api.php) |
| 📚 Informações sobre lugares | **Wikipedia API** | [Wikipedia API](https://www.mediawiki.org/wiki/API:Main_page) |
| 📸 Fotos de lugares | **Wikimedia Commons API** | [Wikimedia Commons API](https://commons.wikimedia.org/w/api.php) |
| 💱 Conversão de moedas | **Frankfurter API** | [Frankfurter Docs](https://frankfurter.dev/docs/) |
| 🚲 Rotas e navegação | **OpenRouteService** | [OpenRouteService API](https://openrouteservice.org/dev/#/api-docs) |
| 🏙️ Dados geográficos | **GeoNames** | [GeoNames Web Services](https://www.geonames.org/export/web-services.html) |

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
- GeoNames exige cadastro de um `username` próprio para as requisições; não
  utilizar a conta `demo` em produção ou nos testes.
- Registrar variáveis de ambiente e o procedimento de configuração na
  documentação da integração correspondente.

## Possível ordem de avaliação

1. Clima com Open-Meteo.
2. Busca de cidades e conteúdo com Algolia.
3. Formulários e newsletter com Tally/Brevo.
4. Proteção de formulários com Cloudflare Turnstile.
5. Comentários e comunidade com Giscus.
6. Push notifications com OneSignal.
7. Chat online com Crisp.
8. Monitoramento externo com UptimeRobot.
9. Produto e comportamento com PostHog, caso o analytics existente não seja suficiente.
