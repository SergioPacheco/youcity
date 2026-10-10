# Solução para Erro de Download do YouTube

## Problema

YouTube está bloqueando downloads via yt-dlp com erro:
```
ERROR: [youtube] H_JV9XnqAm4: Requested format is not available
WARNING: [youtube] HTTP Error 400: Bad Request
```

## Causa

1. **Rate limiting**: YouTube detecta downloads automatizados
2. **Sem JavaScript runtime**: yt-dlp precisa de deno/node
3. **Formato não disponível**: Alguns formatos requerem autenticação

## Solução 1: Usar Cookies (Recomendado)

```bash
# 1. Instalar extensão no Chrome/Firefox
# Chrome: "Get cookies.txt LOCALLY"
# Firefox: "cookies.txt"

# 2. Exportar cookies do YouTube
# - Abrir youtube.com
# - Clicar na extensão
# - Exportar cookies

# 3. Salvar como cookies.txt
# 4. Usar no comando:
yt-dlp --cookies cookies.txt https://www.youtube.com/watch?v=VIDEO_ID
```

## Solução 2: Alternar para API Oficial

Usar YouTube Data API v3 para obter URL do stream:

```python
from googleapiclient.discovery import build

youtube = build('youtube', 'v3', developerKey='API_KEY')
response = youtube.videos().list(id='VIDEO_ID', part='contentDetails').execute()
duration = response['items'][0]['contentDetails']['duration']
```

## Solução 3: Pré-baixar Vídeos

Para MVP, baixar vídeos manualmente e commitar no repo:

```bash
# Baixar vídeo manualmente
youtube-dl -f 'best[height<=720]' https://www.youtube.com/watch?v=VIDEO_ID

# Mover para assets/videos/
mv video.mp4 assets/videos/VIDEO_ID.mp4

# Commitar
git add assets/videos/
git commit -m "feat: add drone video for city X"
```

## Solução 4: Usar Serviço de Proxy

Serviços como `youtube.compproxy` ou `yewtu.be` (instâncias Invidious):

```bash
yt-dlp --extractor-args "youtube:player_client=android" \
       --geo-bypass \
       URL
```

## Para GitHub Actions

```yaml
- name: Setup yt-dlp with cookies
  run: |
    echo "${{ secrets.YOUTUBE_COOKIES }}" > cookies.txt
    yt-dlp --cookies cookies.txt URL
```

## Alternativa: Reduzir Dependência de YouTube

Para o MVP, considerar:

1. **Usar vídeos públicos/royalty-free** de sites como:
   - Pexels (https://www.pexels.com/videos/)
   - Pixabay (https://pixabay.com/videos/)
   - Coverr (https://coverr.co/)

2. **Gerar slides estáticos** com imagens + áudio:
   ```bash
   ffmpeg -loop 1 -i image.jpg -i audio.mp3 -t 30 video.mp4
   ```

3. **Usar apenas áudio da rádio** + imagens da cidade:
   - Menos complexo
   - Mais confiável
   - Formato: slideshow com transições

## Próximos Passos

1. **Curto prazo**: Pré-baixar vídeos das cidades mais populares
2. **Médio prazo**: Implementar cookies do YouTube
3. **Longo prazo**: Considerar API oficial do YouTube ou provedor alternativo
