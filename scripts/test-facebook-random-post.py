#!/usr/bin/env python3
"""
Test script: gera um post aleatório para a página do Facebook sem publicar.
"""

import sys
import random
from pathlib import Path

root = Path(__file__).resolve().parent.parent

if __package__ in (None, ""):
    sys.path.insert(0, str(root / "tools"))
    from social.selector import candidates, weighted_pick
    from social.config import WORLD_SCOPE
    from social.compose_post import compose_post, city_display_label
    from social.utils import city_slug, display_city_name, display_country_name, now_utc
else:
    from tools.social.selector import candidates, weighted_pick
    from tools.social.config import WORLD_SCOPE
    from tools.social.compose_post import compose_post, city_display_label
    from tools.social.utils import city_slug, display_city_name, display_country_name, now_utc


def main():
    ranked = candidates(minimum_modes=1, recent_slugs=set())
    
    if not ranked:
        print("❌ Nenhuma cidade elegível encontrada.")
        return 1
    
    print(f"ℹ️  Pool de cidades elegíveis: {len(ranked)}")
    
    # Seleciona a melhor entre as top 20
    pool_size = min(20, len(ranked))
    rng = random.Random()
    (city, ranking), pick_index = weighted_pick(
        ranked, top_n=pool_size, rng=rng,
        recent_cities=set(), recent_countries=set(), same_day=[]
    )
    
    slug = city_slug(city)
    display_label = city_display_label(city)
    
    print(f"\n✅ Cidade selecionada: {display_label} (slug: {slug})")
    print(f"   Score: {ranking.total} | Posição no sorteio: #{pick_index + 1}/{pool_size}\n")
    
    # Compõe o post para o slot 0 (09:30)
    scope = WORLD_SCOPE
    text = compose_post(city, scope, ranking.total, slot_index=0)
    
    print("=" * 60)
    print("PREVIEW DO POST:")
    print("=" * 60)
    print(text)
    print("=" * 60)
    print(f"\nℹ️  Timestamp: {now_utc().isoformat()}")
    print(f"ℹ️  Comprimento: {len(text)} caracteres")
    
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
