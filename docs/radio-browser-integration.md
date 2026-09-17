# Rádios locais sob demanda

O YouCity mantém as rádios do catálogo disponíveis imediatamente. O botão de
rádio no painel expandido consulta o Radio Browser somente quando o usuário o
aciona; a busca não bloqueia o carregamento inicial e não substitui o catálogo.

## Fluxo

1. O usuário seleciona uma cidade e abre o painel do rádio.
2. O botão `📻` chama `/api/radio-stations` com cidade, país e coordenadas do
   catálogo.
3. A Function consulta os mirrors do Radio Browser, filtra estações verificadas
   com stream HTTPS e sem HLS, e retorna no máximo oito resultados.
4. As estações são adicionadas somente ao ciclo de vida do controlador do rádio.
   Elas não são gravadas no catálogo nem em `localStorage`.
5. Se a consulta falhar ou não retornar resultados, as rádios atuais continuam
   funcionando normalmente.

## Contrato externo

A Function usa o endpoint `/json/stations/search` com `name`, `country`,
`is_https=true`, `has_geo_info=true`, `hidebroken=true`, ordenação por votos e
limite de 25 candidatos antes da normalização. A resposta do frontend é:

```json
{
  "city": "São Paulo",
  "stations": [
    {
      "stationuuid": "...",
      "name": "Radio Example",
      "url": "https://stream.example/radio.mp3",
      "homepage": "https://example.org",
      "favicon": "https://example.org/favicon.png",
      "codec": "MP3",
      "bitrate": 128,
      "source": "radio-browser"
    }
  ]
}
```

O Radio Browser fornece `url_resolved` para clientes que não querem resolver
playlists e redirecionamentos no navegador, além dos campos de saúde da estação,
codec, bitrate e coordenadas. A aplicação usa a URL resolvida e rejeita streams
HTTP, HLS e estações marcadas como quebradas. Consulte a [referência oficial da
API](https://docs.radio-browser.info/).

## Limites e decisões

- Não é necessária uma API key do Radio Browser.
- A busca é limitada a 30 solicitações por cliente em dez minutos na Function,
  com cache de dez minutos por cidade/coordenadas.
- O `AbortController` pertence ao módulo da busca e invalida respostas de cidades
  anteriores.
- O áudio continua sendo carregado diretamente pelo elemento `<audio>`; a
  Function não faz proxy de mídia.
- A API não oferece, no contrato usado, uma busca universal por raio. A Function
  combina nome e país da cidade com `has_geo_info`, calcula a distância haversine
  usando as coordenadas retornadas e aceita apenas estações em até 150 km,
  priorizando as mais próximas e, em empate, as mais votadas.
- O contador de cliques do Radio Browser não é acionado nesta primeira etapa;
  adicionar esse registro exige uma decisão separada sobre telemetria de estações
  de terceiros.
