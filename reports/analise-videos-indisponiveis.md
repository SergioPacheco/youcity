# Análise de Vídeos Indisponíveis no YouCity

**Data da análise:** 2026-10-10  
**Total de vídeos verificados:** 500  
**Vídeos indisponíveis:** 6 (1,2%)

## Resultado

Foram identificados **6 vídeos** que não estão mais disponíveis no YouTube:

| Cidade | Modo | Video ID | Status HTTP | Causa provável |
|--------|------|----------|-------------|----------------|
| Barcelona | walk | `36s5d26vqpw` | 403 Forbidden | Vídeo privado ou removido pelo publicador |
| Barcelona | walk | `0_1VjaM89D0` | 404 Not Found | Vídeo removido ou ID inválido |
| Basel | walk | `MOxPECFU6iU` | 401 Unauthorized | Vídeo privado ou geobloqueado |
| Basel | walk | `N2aIVtWhGIA` | 401 Unauthorized | Vídeo privado ou geobloqueado |
| Bronx | drive | `03Y8ykq2NEk` | 401 Unauthorized | Vídeo privado ou geobloqueado |
| Columbus | drive | `l4S5Xx-fz2o` | 401 Unauthorized | Vídeo privado ou geobloqueado |

## Investigação adicional

Os status **401** e **403** indicam que os vídeos provavelmente:
- Foram marcados como **privados** pelo autor
- Foram **removidos** pelo publicador
- Estão **geobloqueados** ou com restrições de idade

O status **404** (`0_1VjaM89D0`) sugere que o ID pode ter sido **desativado permanentemente** ou nunca existiu.

## Próximos passos

1. **Validar no navegador:** Acessar manualmente cada link para confirmar o status
2. **Substituir vídeos:** Buscar vídeos alternativos para as cidades afetadas
3. **Automatizar verificação:** Criar pipeline CI/CD para detectar vídeos quebrados

## Link para relatório completo

[unavailable-videos.json](./unavailable-videos.json) — Dados detalhados no formato JSON.
