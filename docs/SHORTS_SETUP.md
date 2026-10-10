# Setup Guide: YouCity Shorts no GitHub Actions

## Limitações conhecidas

### 1. YouTube Download (yt-dlp)

**Problema**: YouTube bloqueia downloads de CI/CD (rate limiting, bot detection).

**Solução**: Usar cookies de autenticação.

```bash
# Exportar cookies do navegador
# Chrome: extensão "Get cookies.txt LOCALLY"
# Firefox: extensão "cookies.txt"

# Salvar como cookies.txt
```

```yaml
# Adicionar ao GitHub Secret
YOUTUBE_COOKIES: " conteúdo do cookies.txt "
```

**Alternativa**: Baixar vídeos localmente e commitar no repo (se poucos vídeos).

### 2. Rádio Streaming

**Problema**: Streams podem ter geo-blocking ou falhar em CI.

**Solução**: Múltiplos fallbacks.

```python
# Já implementado: tenta 3 rádios diferentes
# Se todas falharem, usa áudio original do vídeo
```

### 3. Fontes para Overlays

**Problema**: GitHub Actions não tem fontes por padrão.

**Solução**: Instalar pacote `fonts-dejavu-core`.

```yaml
# Já adicionado ao workflow
- name: Install fonts
  run: sudo apt-get install -y fonts-dejavu-core
```

### 4. YouTube Data API Quota

**Problema**: 10.000 unidades/dia (limite baixo).

**Solução**: 
- Monitorar quota
- Publicar máx 6 vídeos/dia
- Ou pular YouTube no MVP

### 5. TikTok API Approval

**Problema**: TikTok precisa aprovar seu app (pode demorar dias/semanas).

**Solução**: 
- Usar apenas Facebook + YouTube no MVP
- Adicionar TikTok depois da aprovação

## Secrets necessários

### Facebook Reels ✅

```bash
# 1. Criar System User no Meta Business Suite
# 2. Adicionar página como asset
# 3. Gerar token (sem expiração)

FB_SYSTEM_USER_TOKEN=EAAxxx...
FACEBOOK_PAGE_ID=123456789
```

### YouTube Shorts ⚠️

```bash
# 1. Criar projeto no Google Cloud Console
# 2. Habilitar YouTube Data API v3
# 3. Criar OAuth2 credentials (Desktop app)
# 4. Autorizar manualmente (primeira vez)
# 5. Salvar credentials.json

# Script para gerar token inicial:
python tools/social/youtube_auth.py --client-id xxx --client-secret xxx

# Exportar JSON como secret:
YOUTUBE_CREDENTIALS_JSON={"installed":{"client_id":"xxx"...}}
```

### TikTok ❓

```bash
# 1. Registrar app em developers.tiktok.com
# 2. Submeter para review (Content Posting API)
# 3. Após aprovação, obter access_token e open_id

TIKTOK_ACCESS_TOKEN=xxx
TIKTOK_OPEN_ID=xxx
```

### YouTube Cookies (opcional, mas recomendado)

```bash
# Exportar cookies do navegador autenticado
# Chrome: extensão "Get cookies.txt LOCALLY"

YOUTUBE_COOKIES="# Netscape HTTP Cookie File\n..."
```

## Testar localmente

### 1. Instalar dependências

```bash
pip install -r requirements-shorts.txt
sudo apt install ffmpeg fonts-dejavu-core  # Linux
```

### 2. Testar componentes

```bash
# Teste completo (sem publicar)
python scripts/test-shorts.py

# Teste específico
python scripts/test-shorts.py --test video
python scripts/test-shorts.py --test audio
python scripts/test-shorts.py --test full
```

### 3. Testar com cidade específica

```bash
# Gerar vídeo (sem publicar)
python tools/social/shorts_daily.py \
  --city sao-paulo \
  --duration 15 \
  --generate-only

# Verificar vídeo gerado
ls -lh out/shorts/*/sao-paulo_final.mp4
```

### 4. Testar publicação (Facebook apenas)

```bash
# Configurar token
export FB_SYSTEM_USER_TOKEN="EAAxxx"
export FACEBOOK_PAGE_ID="123456"

# Publicar
python tools/social/shorts_daily.py \
  --city sao-paulo \
  --duration 30 \
  --platforms facebook
```

## Debug no GitHub Actions

### Verificar logs

```bash
# Workflow > Run > View logs
# Procurar por:
# - "❌" (erros)
# - "⚠️" (warnings)
# - "✓" (sucessos)
```

### Testar workflow manualmente

1. Ir em Actions > "YouCity Shorts Daily"
2. Clicar em "Run workflow"
3. Especificar cidade e duração
4. Verificar logs em tempo real

### Problemas comuns

#### "yt-dlp error: HTTP Error 403"

**Causa**: YouTube bloqueou download.

**Solução**: Adicionar `YOUTUBE_COOKIES` secret.

#### "FFmpeg error: fontfile not found"

**Causa**: Fontes não instaladas.

**Solução**: Verificar se `fonts-dejavu-core` está no workflow.

#### "TikTok API error: unauthorized"

**Causa**: App não aprovado.

**Solução**: Pular TikTok ou aguardar aprovação.

#### "YouTube quota exceeded"

**Causa**: Limite diário atingido.

**Solução**: Reduzir frequência ou pular YouTube.

## Checklist antes de ativar

- [ ] Testar localmente com `python scripts/test-shorts.py`
- [ ] Gerar vídeo de teste com `--generate-only`
- [ ] Configurar `FB_SYSTEM_USER_TOKEN` e `FACEBOOK_PAGE_ID`
- [ ] (Opcional) Configurar `YOUTUBE_CREDENTIALS_JSON`
- [ ] (Opcional) Configurar `YOUTUBE_COOKIES`
- [ ] (Opcional) Configurar `TIKTOK_ACCESS_TOKEN` e `TIKTOK_OPEN_ID`
- [ ] Testar workflow manualmente no GitHub Actions
- [ ] Verificar logs e corrigir erros
- [ ] Ativar schedule automático

## Monitoramento

### Verificar histórico

```bash
# Ver últimas publicações
cat social/shorts_published.json | jq '.[-5:]'
```

### Verificar quota YouTube

```bash
# Via API
python -c "
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

creds = Credentials.from_authorized_user_file('credentials.json')
youtube = build('youtube', 'v3', credentials=creds)
quota = youtube.quota().list().execute()
print(quota)
"
```

### Verificar posts no Facebook

```bash
# Via Graph API
curl "https://graph.facebook.com/v23.0/{page_id}/posts?access_token={token}"
```

## Próximos passos

1. **Fase 1**: Facebook apenas (mais confiável)
2. **Fase 2**: Adicionar YouTube (após OAuth setup)
3. **Fase 3**: Adicionar TikTok (após aprovação)
4. **Fase 4**: Otimizar (cache de vídeos, paralelismo)
