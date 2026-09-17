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

## Música atual e videoclipe

O botão `♫` do painel inicia, somente após solicitação do usuário, uma consulta
ao endpoint `/api/radio-now-playing`. A Function resolve a estação pelo Radio
Browser e tenta ler o campo `StreamTitle` dos metadados ICY do stream. Quando há
artista e título, o botão `Find music video` consulta `/api/youtube-search` e
mostra até três candidatos. O iframe do YouTube só é criado depois que o
usuário escolhe um resultado.

Esse fluxo é best-effort: rádios podem não transmitir `artist/title`, podem
transmitir o nome de um programa ou podem não estar indexadas pelo Radio
Browser. Nesses casos a interface informa que não há metadados disponíveis e
mantém o áudio funcionando. A busca usa a `YOUTUBE_API_KEY` exclusivamente no
backend; o desenvolvimento local com Functions pode ser executado com um
arquivo `.dev.vars` contendo essa variável, conforme a documentação do
Comment Assistant.

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
- Não há reconhecimento acústico/fingerprinting. Isso fica fora do escopo por
  custo, privacidade e complexidade operacional.
