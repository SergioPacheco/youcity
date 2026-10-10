"""
Orquestrador principal: gera e publica shorts diariamente.

Fluxo:
1. Seleciona cidade aleatória com modo drone
2. Baixa vídeo do YouTube (yt-dlp)
3. Captura áudio da rádio (FFmpeg)
4. Edita vídeo final (FFmpeg)
5. Publica em Facebook, YouTube, TikTok
6. Persiste histórico
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

# Imports internos
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from audio_capture import capture_best_radio, get_city_radios
    from video_editor import download_youtube_segment, edit_short_video, get_city_drone_video, get_city_info
    from publishers import MultiPublisher
    from utils import city_slug, city_url, display_city_name, display_country_name, now_utc, read_json, write_json
    from selector import candidates, weighted_pick
else:
    from .audio_capture import capture_best_radio, get_city_radios
    from .video_editor import download_youtube_segment, edit_short_video, get_city_drone_video, get_city_info
    from .publishers import MultiPublisher
    from .utils import city_slug, city_url, display_city_name, display_country_name, now_utc, read_json, write_json
    from .selector import candidates, weighted_pick


# Configurações
OUTPUT_DIR = Path("out") / "shorts"
STATE_FILE = Path("social") / "shorts_published.json"
LOGO_PATH = Path("assets") / "logo-youcity.png"
DEFAULT_DURATION = 30  # segundos
DEFAULT_RECENT_DAYS = 45  # dias para não repetir cidade


def load_catalog() -> list[dict]:
    """Carrega catálogo de cidades."""
    catalog_path = Path("data") / "catalog.json"
    if not catalog_path.exists():
        raise FileNotFoundError(f"Catálogo não encontrado: {catalog_path}")
    
    with open(catalog_path, encoding="utf-8") as f:
        return json.load(f)


def select_city_for_short(
    catalog: list[dict],
    recent_days: int = DEFAULT_RECENT_DAYS,
    top_n: int = 20,
) -> dict:
    """
    Seleciona cidade aleatória com modo drone.
    
    Reaproveita lógica do selector.py, mas filtra apenas cidades com drone.
    """
    # Carregar histórico
    state = read_json(STATE_FILE, [])
    recent_slugs = _load_recent_slugs(state, recent_days)
    
    # Filtrar cidades com drone
    cities_with_drone = [
        city for city in catalog
        if city.get("videos", {}).get("drone")
    ]
    
    if not cities_with_drone:
        raise ValueError("Nenhuma cidade com modo drone encontrada")
    
    # Remover cidades recentes
    eligible = [
        city for city in cities_with_drone
        if city_slug(city) not in recent_slugs
    ]
    
    if not eligible:
        print("⚠️  Todas as cidades com drone foram usadas recentemente. Resetando...")
        eligible = cities_with_drone
    
    # Seleção aleatória simples (sem ranking complexo por enquanto)
    import random
    city = random.choice(eligible)
    
    return city


def _load_recent_slugs(state: list, days: int) -> set[str]:
    """Carrega slugs publicados nos últimos N dias."""
    cutoff = now_utc() - timedelta(days=days)
    return {
        str(item.get("city_slug", ""))
        for item in state
        if isinstance(item, dict)
        and item.get("city_slug")
        and item.get("status") == "published"
        and _parse_datetime(item.get("published_at")) >= cutoff
    }


def _parse_datetime(value: Optional[str]) -> datetime:
    """Parse de datetime ISO."""
    if not value:
        return now_utc()
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except:
        return now_utc()


def generate_short(
    city: dict,
    duration: int,
    output_dir: Path,
) -> tuple[Optional[Path], Optional[dict]]:
    """
    Gera vídeo short para uma cidade.
    
    Returns:
        (video_path, radio_info) ou (None, None)
    """
    slug = city_slug(city)
    city_name = display_city_name(city)
    country_name = display_country_name(city)
    
    print(f"\n🎬 Gerando short para: {city_name}, {country_name}")
    print(f"   Slug: {slug}")
    
    # 1. Obter vídeo drone
    drone_video = get_city_drone_video([city], slug)
    if not drone_video:
        print("   ❌ Cidade não tem modo drone")
        return None, None
    
    video_id = drone_video.get("id")
    start = drone_video.get("start", 0)
    
    print(f"   ✓ Vídeo YouTube: {video_id} (start: {start}s)")
    
    # 2. Baixar vídeo
    raw_video_path = output_dir / f"{slug}_raw.mp4"
    downloaded = download_youtube_segment(
        video_id=video_id,
        start=start,
        duration=duration + 5,  # Extra para cortar
        output_path=raw_video_path,
    )
    
    if not downloaded:
        print("   ❌ Falha ao baixar vídeo")
        return None, None
    
    # 3. Capturar áudio da rádio
    radios = city.get("radios", [])
    audio_path = None
    radio_info = None
    
    if radios:
        audio_path, radio_info = capture_best_radio(
            radios=radios,
            duration=duration,
            output_dir=output_dir,
        )
    else:
        print("   ⚠️  Cidade sem rádios, usando áudio original")
    
    # 4. Editar vídeo final
    final_path = output_dir / f"{slug}_final.mp4"
    
    edited = edit_short_video(
        video_path=downloaded,
        audio_path=audio_path,
        output_path=final_path,
        city_name=city_name,
        country_name=country_name,
        radio_name=radio_info.get("name") if radio_info else None,
        logo_path=LOGO_PATH if LOGO_PATH.exists() else None,
        duration=duration,
    )
    
    if edited:
        return edited, radio_info
    
    return None, None


def publish_short(
    video_path: Path,
    city: dict,
    radio_info: Optional[dict],
    platforms: list[str],
) -> dict[str, str]:
    """
    Publica vídeo nas plataformas configuradas.
    
    Returns:
        Dict com platform -> post_id
    """
    city_name = display_city_name(city)
    country_name = display_country_name(city)
    slug = city_slug(city)
    url = city_url(city, "WORLD")
    
    # Montar título/caption
    title = f"Discover {city_name} from above! 🚁"
    description = (
        f"Explore {city_name}, {country_name} with YouCity.\n\n"
        f"Experience the city virtually: {url}\n\n"
        f"#YouCity #DroneView #VirtualTravel #CityExplorer"
    )
    tags = ["YouCity", "DroneView", "VirtualTravel", "CityExplorer", city_name.replace(" ", "")]
    
    # Adicionar rádio se capturada
    if radio_info:
        radio_name = radio_info.get("name", "")
        description += f"\n\n📻 Radio: {radio_name}"
    
    # Configurar publisher
    import os
    
    publisher = MultiPublisher(
        facebook_token=os.getenv("FB_SYSTEM_USER_TOKEN"),
        youtube_credentials=Path(os.getenv("YOUTUBE_CREDENTIALS_PATH", "credentials.json")),
        tiktok_token=os.getenv("TIKTOK_ACCESS_TOKEN"),
        tiktok_open_id=os.getenv("TIKTOK_OPEN_ID"),
    )
    
    # Publicar
    print(f"\n📤 Publicando em: {', '.join(platforms)}")
    
    results = publisher.publish_all(
        video_path=video_path,
        title=title,
        description=description,
        tags=tags,
        facebook_page_id=os.getenv("FACEBOOK_PAGE_ID"),
    )
    
    return results


def save_state(
    city: dict,
    video_path: Path,
    radio_info: Optional[dict],
    results: dict[str, str],
):
    """Persiste histórico de publicação."""
    state = read_json(STATE_FILE, [])
    
    entry = {
        "city_slug": city_slug(city),
        "city_name": display_city_name(city),
        "country": display_country_name(city),
        "video_path": str(video_path),
        "video_size_mb": round(video_path.stat().st_size / 1024 / 1024, 2),
        "radio_name": radio_info.get("name") if radio_info else None,
        "published_at": now_utc().isoformat(),
        "status": "published",
        "platforms": results,
        "url": city_url(city, "WORLD"),
    }
    
    state.append(entry)
    
    # Manter apenas últimos 1000 registros
    state = state[-1000:]
    
    write_json(STATE_FILE, state)
    print(f"   ✓ Histórico salvo em {STATE_FILE}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Gera e publica shorts diariamente"
    )
    parser.add_argument(
        "--city",
        metavar="SLUG",
        help="Força uma cidade específica (para teste)"
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=DEFAULT_DURATION,
        help=f"Duração do vídeo em segundos (default: {DEFAULT_DURATION})"
    )
    parser.add_argument(
        "--recent-days",
        type=int,
        default=DEFAULT_RECENT_DAYS,
        help=f"Dias para não repetir cidade (default: {DEFAULT_RECENT_DAYS})"
    )
    parser.add_argument(
        "--platforms",
        default="facebook,youtube,tiktok",
        help="Plataformas separadas por vírgula (default: facebook,youtube,tiktok)"
    )
    parser.add_argument(
        "--generate-only",
        action="store_true",
        help="Gera vídeo sem publicar"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Seleciona cidade e gera vídeo, mas não publica"
    )
    
    args = parser.parse_args()
    
    platforms = [p.strip().lower() for p in args.platforms.split(",")]
    
    print("🚀 YouCity Shorts Daily")
    print(f"   Plataformas: {', '.join(platforms)}")
    print(f"   Duração: {args.duration}s")
    print(f"   Anti-duplicate: {args.recent_days} dias")
    
    try:
        # 1. Carregar catálogo
        print("\n📚 Carregando catálogo...")
        catalog = load_catalog()
        print(f"   {len(catalog)} cidades encontradas")
        
        # 2. Selecionar cidade
        if args.city:
            city = get_city_info(catalog, args.city)
            if not city:
                print(f"❌ Cidade não encontrada: {args.city}")
                return 1
        else:
            city = select_city_for_short(catalog, args.recent_days)
        
        print(f"\n✓ Cidade selecionada: {display_city_name(city)}, {display_country_name(city)}")
        
        # 3. Preparar diretório de saída
        output_dir = OUTPUT_DIR / str(date.today())
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 4. Gerar vídeo
        video_path, radio_info = generate_short(
            city=city,
            duration=args.duration,
            output_dir=output_dir,
        )
        
        if not video_path:
            print("\n❌ Falha ao gerar vídeo")
            return 1
        
        print(f"\n✅ Vídeo gerado: {video_path}")
        print(f"   Tamanho: {video_path.stat().st_size / 1024 / 1024:.1f} MB")
        
        # 5. Publicar (se não for generate-only ou dry-run)
        if args.generate_only or args.dry_run:
            print(f"\nℹ️  Modo {'generate-only' if args.generate_only else 'dry-run'}: vídeo NÃO publicado")
            return 0
        
        results = publish_short(
            video_path=video_path,
            city=city,
            radio_info=radio_info,
            platforms=platforms,
        )
        
        # 6. Salvar estado
        save_state(city, video_path, radio_info, results)
        
        # 7. Resumo
        print("\n" + "=" * 60)
        print("📊 RESUMO")
        print("=" * 60)
        print(f"Cidade: {display_city_name(city)}, {display_country_name(city)}")
        print(f"Vídeo: {video_path.name}")
        print(f"Rádio: {radio_info.get('name') if radio_info else 'N/A'}")
        print(f"\nPublicações:")
        
        for platform, post_id in results.items():
            if platform.endswith("_error"):
                print(f"  ❌ {platform.replace('_error', '')}: {post_id[:100]}")
            else:
                print(f"  ✅ {platform}: {post_id}")
        
        print("=" * 60)
        
        return 0
        
    except Exception as e:
        print(f"\n❌ Erro: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    # Carregar .env para testes locais
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from tools.social.load_env import load_env
    load_env()
    
    sys.exit(main())
