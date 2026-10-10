#!/usr/bin/env python3
"""
Remove vídeos indisponíveis do catalog.json e busca substitutos se necessário.
"""

import json
import sys

def load_catalog(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_catalog(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def get_video_url(video_id):
    return f"https://www.youtube.com/watch?v={video_id}"

def find_alternative_video(city_name, mode, existing_ids, unavailable_id):
    """
    Busca um vídeo alternativo baseado no nome da cidade e modo.
    Neste MVP, retorna None e deixa a cidade sem vídeo nesse modo.
    """
    # Em produção, poderíamos:
    # - Buscar vídeos do YouTube usando a API
    # - Consultar base de dados de vídeos previamente curados
    # - Buscar vídeos com termos como "{city_name} {mode}"
    
    print(f"  [ATENÇÃO] {city_name} ({mode}): {unavailable_id} removido")
    print(f"    Sugestão: buscar novo vídeo com termos '{city_name} {mode}'")
    return None

def main():
    catalog_path = '/home/user-sn-387444/Documentos/code/youcity/data/catalog.json'
    unavailable_path = '/home/user-sn-387444/Documentos/code/youcity/reports/unavailable-videos.json'
    
    # Carregar dados
    catalog = load_catalog(catalog_path)
    
    with open(unavailable_path, 'r', encoding='utf-8') as f:
        unavailable = json.load(f)
    
    # Criar set de IDs indisponíveis
    unavailable_ids = {v['videoId']: v for v in unavailable}
    
    # Contadores
    removed_count = 0
    cities_without_videos = []
    
    for city in catalog:
        city_name = city['name']
        city_had_videos = False
        city_still_has_videos = False
        
        for mode in ['drive', 'bike', 'walk', 'drone', 'beach_walk']:
            videos = city.get('videos', {}).get(mode, [])
            
            if videos:
                city_had_videos = True
            
            # Filtrar vídeos indisponíveis
            original_count = len(videos)
            filtered_videos = [v for v in videos if v['id'] not in unavailable_ids]
            new_count = len(filtered_videos)
            
            if original_count != new_count:
                removed_count += (original_count - new_count)
                print(f"{city_name} ({mode}): {original_count - new_count} vídeo(s) removido(s)")
                
                # Verificar se ainda há vídeos neste modo
                if new_count == 0 and city_had_videos:
                    city_still_has_videos = False
                    print(f"  [CRÍTICO] {city_name} ({mode}): SEM VÍDEOS RESTANTES!")
                    cities_without_videos.append({
                        'city': city_name,
                        'mode': mode,
                        'removed': [v['id'] for v in videos if v['id'] in unavailable_ids]
                    })
            
            city['videos'][mode] = filtered_videos
        
        if not any(city.get('videos', {}).get(m, []) for m in ['drive', 'bike', 'walk', 'drone', 'beach_walk']) and city_had_videos:
            print(f"  [CRÍTICO] {city_name}: TUDO REMOVIDO!")
    
    # Salvar catalog atualizado
    save_catalog(catalog_path, catalog)
    
    print(f"\n=== Resumo ===")
    print(f"Vídeos removidos: {removed_count}")
    print(f"Cidades sem vídeos em algum modo: {len(cities_without_videos)}")
    
    if cities_without_videos:
        print("\nCidades afetadas:")
        for c in cities_without_videos:
            print(f"  - {c['city']} ({c['mode']}): {c['removed']}")
    
    print(f"\nCatalog atualizado salvo em: {catalog_path}")

if __name__ == '__main__':
    main()
