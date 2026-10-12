# Facebook Reels com drones pré-gerados

O workflow `Facebook Reels Daily` publica exclusivamente no Facebook usando os
secrets `FB_SYSTEM_USER_TOKEN` e `FACEBOOK_PAGE_ID`. A variável opcional
`META_GRAPH_VERSION` configura a versão da API (padrão `v23.0`). YouTube e TikTok
não são plataformas ativas nesse workflow.

## Biblioteca

Os 100 MP4 ficam em `social/reels/videos/`; `social/reels/catalog.json` registra
cidade, país, vídeo de origem, autor, trecho, data de captura, rádio quando
obtida, propriedades do MP4, tamanho e SHA-256. São clipes de drones reais de
15 segundos, 540×960, H.264/AAC e 25 fps, com branding YouCity. A rádio é
opcional; sua indisponibilidade resulta em uma faixa silenciosa.

Os vídeos são capturados neste computador e commitados. O job do Actions não
instala navegador, não acessa o player e não baixa vídeos do YouTube. Ele
valida a biblioteca, seleciona um MP4 local e envia ao Facebook. A descrição
inclui a referência ao drone original.

Cada execução normal escolhe uma cidade que não tenha uma publicação
confirmada no Facebook nos últimos 45 dias. Se não houver cidade elegível,
a execução informa o motivo e não repete uma cidade dentro da janela.
`--city` é uma escolha manual explícita e permite revisar ou publicar uma
cidade específica independentemente da janela.

O envio usa `/{page_id}/video_reels`: iniciar sessão, enviar o MP4 à URL
retornada, finalizar como `PUBLISHED` e consultar o processamento. Somente
publicações confirmadas entram no histórico como `published`. Falhas deixam
o Actions com erro e não bloqueiam a cidade na janela de repetição.

## Revisar sem publicar

No GitHub, execute o workflow manualmente com `generate_only=true` e,
opcionalmente, a cidade. O MP4 selecionado fica no artifact
`facebook-reels-video` por 7 dias. Os arquivos permanentes ficam no Git;
o artifact é somente uma cópia para revisão.

Localmente, usando as dependências já instaladas neste projeto:

```bash
.venv-shorts/bin/python -m tools.social.reels_library --expected-count 100
.venv-shorts/bin/python tools/social/shorts_daily.py --source prerecorded --platforms facebook --generate-only
```

Retirar `--generate-only` autoriza o envio ao Facebook. No computador local,
as credenciais podem vir do `.env` ignorado pelo Git ou de variáveis exportadas.
No Actions, vêm dos secrets. O workflow executa às 12:00 e 18:00 de Brasília.

## Gerar ou retomar a biblioteca local

Instale FFmpeg, fontes DejaVu e as dependências de captura na máquina que
consegue reproduzir os drones. Não é necessário token da API do YouTube.

```bash
python3 -m venv .venv-shorts
.venv-shorts/bin/python -m pip install -r requirements-shorts.txt
.venv-shorts/bin/python -m playwright install --with-deps chromium
.venv-shorts/bin/python tools/social/pregenerate_reels.py --count 100 --workers 6
```

O gerador retoma os MP4 já validados, prioriza cidades diferentes e descarta
fontes indisponíveis. Se necessário para atingir 100 clipes, captura trechos
distintos de drones disponíveis. Cada worker grava em seu próprio diretório
em `out/reels-library/`, onde ficam originais, áudio, logs e metadados de captura.
Somente o processo principal copia MP4 aprovados para a biblioteca e atualiza
o catálogo atomicamente. Nenhum vídeo é publicado por esse comando.

A captura exige quadros decodificados, relógio avançando e o identificador
real do drone durante toda a gravação. Uma mudança para outro vídeo, uma tela
de erro ou um arquivo fora do formato exigido invalida o clipe. A publicação
valida hashes e formatos antes de usar os arquivos.
