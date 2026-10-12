# Biblioteca de drones para Facebook Reels

O usuário autorizou gerar e commitar 100 vídeos de drones para que o GitHub Actions publique no Facebook sem obter vídeos do YouTube durante a execução. Devem ser drones reais, nunca fotos animadas ou outros modos. Os secrets existentes são FB_SYSTEM_USER_TOKEN e FACEBOOK_PAGE_ID.

Guardar exatamente 100 MP4 em social/reels/videos, com catálogo em social/reels/catalog.json. Priorizar cidades diferentes; se fontes indisponíveis impedirem 100 cidades, usar trechos distintos de drones disponíveis. Cada clipe terá 15 segundos, 540×960, H.264/AAC, 25 fps e branding YouCity. A rádio é opcional. Registrar origem, cidade, trecho, data de captura, tamanho e SHA-256.

A geração acontece neste computador, onde a reprodução de Lisboa já foi verificada. O lote deve permitir retomada, validar a reprodução e identificar o vídeo real durante toda a gravação. Arquivos temporários permanecem em out/; somente MP4 aprovados e seu catálogo entram no Git.

No Actions, carregar somente vídeos presentes e validados na biblioteca, respeitar 45 dias sem repetir cidade e publicar somente no Facebook. Não instalar Chromium nem baixar drones no job de publicação. Preservar geração sem publicação para verificar o workflow. Não executar uma publicação real sem instrução explícita.
