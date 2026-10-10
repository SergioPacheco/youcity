"""
Editor de vídeo para shorts.

Usa FFmpeg e yt-dlp para:
1. Baixar vídeo do YouTube (modo drone)
2. Substituir áudio pelo stream de rádio
3. Adicionar overlays (cidade, logo, rádio)
4. Exportar em formato vertical (9:16)
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Optional


def download_youtube_segment(
    video_id: str,
    start: int,
    duration: int,
    output_path: Path,
    quality: str = "720",
    cookies_path: Optional[Path] = None,
) -> Optional[Path]:
    """
    Baixa segmento de vídeo do YouTube via yt-dlp.
    
    Args:
        video_id: ID do vídeo do YouTube
        start: Segundo inicial
        duration: Duração em segundos
        output_path: Caminho de saída
        quality: Qualidade máxima (720, 1080)
        cookies_path: Caminho para cookies.txt (evita bloqueio em CI)
    
    Returns:
        Path do vídeo ou None se falhou
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Adicionar deno ao PATH (necessário para yt-dlp)
    import os
    deno_path = Path.home() / ".deno" / "bin"
    if deno_path.exists():
        os.environ["PATH"] = f"{deno_path}:{os.environ.get('PATH', '')}"
    
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    # Estratégia 1: Baixar trecho específico (pode falhar com certos formatos)
    cmd = [
        "yt-dlp",
        "--format", "394+139",  # 144p + audio (formato que funciona)
        "--download-section", f"*{start}-{start + duration}",
        "--output", str(output_path),
        "--no-playlist",
        "--quiet",
        "--no-warnings",
        "--user-agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        # Importante: usar cookies se disponível para evitar bloqueio
        "--extractor-args", "youtube:player_client=android",
    ]
    
    if cookies_path and cookies_path.exists():
        cmd.extend(["--cookies", str(cookies_path)])
    
    cmd.append(url)
    
    print(f"   📥 Baixando vídeo: {video_id}")
    print(f"      Trecho: {start}s - {start + duration}s")
    
    try:
        result = subprocess.run(cmd, timeout=120, capture_output=True, text=True)
        
        if result.returncode == 0 and output_path.exists() and output_path.stat().st_size > 0:
            print(f"      ✓ Baixado: {output_path.stat().st_size / 1024 / 1024:.1f} MB")
            return output_path
        
        # Estratégia 2: Baixar vídeo completo e cortar depois
        print("   🔄 Tentando baixar vídeo completo...")
        full_video_path = output_path.parent / f"{video_id}_full.mp4"
        
        cmd_full = [
            "yt-dlp",
            "--format", "394+139",  # 144p + audio (formato disponível sem JS runtime)
            "--output", str(full_video_path),
            "--no-playlist",
            "--quiet",
            "--no-warnings",
            url
        ]
        
        result = subprocess.run(
            cmd_full, 
            timeout=300, 
            capture_output=True, 
            text=True,
            env=os.environ.copy()  # Herdar PATH com deno
        )
        
        if result.returncode != 0:
            print(f"   ⚠️  yt-dlp error: {result.stderr[:200]}")
            return None
        
        if not full_video_path.exists():
            print("   ⚠️  Arquivo não baixado")
            return None
        
        print(f"      ✓ Vídeo completo: {full_video_path.stat().st_size / 1024 / 1024:.1f} MB")
        
        # Cortar trecho com FFmpeg
        print(f"      ✂️  Cortando trecho {start}s - {start + duration}s...")
        import subprocess as sp
        
        cut_cmd = [
            "ffmpeg", "-y",
            "-ss", str(start),
            "-i", str(full_video_path),
            "-t", str(duration),
            "-c", "copy",
            str(output_path)
        ]
        
        cut_result = sp.run(cut_cmd, timeout=60, capture_output=True, text=True)
        
        if cut_result.returncode != 0:
            print(f"      ⚠️  FFmpeg cut error: {cut_result.stderr[:200]}")
            return None
        
        if output_path.exists() and output_path.stat().st_size > 0:
            print(f"      ✓ Trecho cortado: {output_path.stat().st_size / 1024:.1f} KB")
            # Remover vídeo completo
            full_video_path.unlink()
            return output_path
        
        return None
        
    except subprocess.TimeoutExpired:
        print("   ⚠️  Timeout no download")
        return None
    except FileNotFoundError:
        print("   ❌ yt-dlp não encontrado. Instale: pip install yt-dlp")
        raise


def edit_short_video(
    video_path: Path,
    audio_path: Optional[Path],
    output_path: Path,
    city_name: str,
    country_name: str,
    radio_name: Optional[str] = None,
    logo_path: Optional[Path] = None,
    duration: int = 30,
) -> Optional[Path]:
    """
    Edita vídeo final com overlays.
    
    Args:
        video_path: Vídeo baixado
        audio_path: Áudio da rádio (opcional)
        output_path: Caminho de saída
        city_name: Nome da cidade para overlay
        country_name: Nome do país
        radio_name: Nome da rádio para overlay
        logo_path: Logo para watermark
        duration: Duração final em segundos
    
    Returns:
        Path do vídeo editado ou None se falhou
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print(f"   ✂️  Editando vídeo...")
    
    # Verificar fonte disponível (GitHub Actions usa DejaVu)
    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # GitHub Actions
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",  # Arch Linux
        "/System/Library/Fonts/Helvetica.ttc",  # macOS
    ]
    
    font_file = None
    for path in font_paths:
        if Path(path).exists():
            font_file = path
            break
    
    # Construir filtros
    filters = []
    
    # 1. Overlay de texto (cidade/país)
    city_text = f"{city_name} – {country_name}"
    
    if font_file:
        filters.append(
            f"drawtext=text='{city_text}':"
            f"fontsize=48:fontcolor=white:"
            f"x=20:y=h-120:"
            f"shadowcolor=black:shadowx=2:shadowy=2:"
            f"fontfile={font_file}"
        )
    else:
        # Fallback sem fonte específica (usa default)
        filters.append(
            f"drawtext=text='{city_text}':"
            f"fontsize=48:fontcolor=white:"
            f"x=20:y=h-120:"
            f"shadowcolor=black:shadowx=2:shadowy=2"
        )
    
    # 2. Nome da rádio
    if radio_name:
        radio_text = f"📻 {radio_name[:30]}"
        filters.append(
            f"drawtext=text='{radio_text}':"
            f"fontsize=28:fontcolor=white:"
            f"x=20:y=h-60:"
            f"shadowcolor=black:shadowx=1:shadowy=1"
        )
    
    # 3. Logo (se existir)
    if logo_path and logo_path.exists():
        filters.append(f"[1:v]scale=120:-1[logo]")
        video_filter = f"[0:v]{','.join(filters)}[vtext];[vtext][logo]overlay=W-140:20[v]"
    else:
        video_filter = f"[0:v]{','.join(filters)}[v]"
    
    # Montar comando FFmpeg
    cmd = ["ffmpeg", "-y"]
    
    # Input: vídeo
    cmd.extend(["-i", str(video_path)])
    
    # Input: logo (se existir)
    if logo_path and logo_path.exists():
        cmd.extend(["-i", str(logo_path)])
    
    # Input: áudio da rádio (se existir)
    if audio_path and audio_path.exists():
        cmd.extend(["-i", str(audio_path)])
        audio_map = "-map 2:a"  # Usa áudio da rádio
    else:
        audio_map = "-map 0:a"  # Usa áudio original do vídeo
    
    # Filtros e codecs
    cmd.extend([
        "-filter_complex", video_filter,
        "-map", "0:v",  # Vídeo original
        audio_map,       # Áudio (rádio ou original)
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-t", str(duration),
        "-aspect", "9:16",  # Formato vertical
        "-movflags", "+faststart",
        str(output_path)
    ])
    
    try:
        result = subprocess.run(
            cmd,
            timeout=60,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print(f"   ⚠️  FFmpeg error: {result.stderr[:500]}")
            return None
        
        if output_path.exists() and output_path.stat().st_size > 0:
            print(f"      ✓ Vídeo editado: {output_path.stat().st_size / 1024 / 1024:.1f} MB")
            return output_path
        
        return None
        
    except subprocess.TimeoutExpired:
        print("   ⚠️  Timeout na edição")
        return None


def get_city_drone_video(catalog: list[dict], city_slug: str) -> Optional[dict]:
    """Retorna primeiro vídeo drone da cidade."""
    for city in catalog:
        slug = city.get("name", "").lower().replace(" ", "-")
        if slug == city_slug.lower():
            videos = city.get("videos", {})
            drone_videos = videos.get("drone", [])
            if drone_videos:
                return drone_videos[0]
    return None


def get_city_info(catalog: list[dict], city_slug: str) -> Optional[dict]:
    """Retorna informações da cidade."""
    for city in catalog:
        slug = city.get("name", "").lower().replace(" ", "-")
        if slug == city_slug.lower():
            return city
    return None


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Editor de vídeo para shorts"
    )
    parser.add_argument(
        "--city",
        metavar="SLUG",
        required=True,
        help="Slug da cidade (ex: sao-paulo)"
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=30,
        help="Duração do vídeo em segundos (default: 30)"
    )
    parser.add_argument(
        "--audio",
        type=Path,
        help="Arquivo de áudio da rádio (opcional)"
    )
    parser.add_argument(
        "--radio-name",
        help="Nome da rádio para overlay"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Diretório de saída (default: out/shorts/YYYY-MM-DD)"
    )
    
    args = parser.parse_args()
    
    try:
        # Diretório de saída
        if args.output_dir is None:
            from datetime import date
            output_dir = Path("out") / "shorts" / str(date.today())
        else:
            output_dir = args.output_dir
        
        # Carregar catálogo
        print("📚 Carregando catálogo...")
        catalog_path = Path(__file__).parent.parent.parent / "data" / "catalog.json"
        with open(catalog_path, encoding="utf-8") as f:
            catalog = json.load(f)
        
        # Obter info da cidade
        city_info = get_city_info(catalog, args.city)
        if not city_info:
            print(f"❌ Cidade não encontrada: {args.city}")
            return 1
        
        city_name = city_info.get("name", "Unknown")
        country_name = city_info.get("country", "Unknown")
        
        print(f"✓ Cidade: {city_name}, {country_name}")
        
        # Obter vídeo drone
        drone_video = get_city_drone_video(catalog, args.city)
        if not drone_video:
            print(f"❌ Cidade não tem modo drone: {args.city}")
            return 1
        
        video_id = drone_video.get("id")
        start = drone_video.get("start", 0)
        
        print(f"✓ Vídeo drone: {video_id} (start: {start}s)")
        
        # Baixar vídeo
        raw_video_path = output_dir / f"{args.city}_raw.mp4"
        downloaded = download_youtube_segment(
            video_id=video_id,
            start=start,
            duration=args.duration + 5,  # Extra para cortar
            output_path=raw_video_path,
        )
        
        if not downloaded:
            print("❌ Falha ao baixar vídeo")
            return 1
        
        # Editar vídeo
        final_path = output_dir / f"{args.city}_final.mp4"
        logo_path = Path(__file__).parent.parent.parent / "assets" / "logo-youcity.png"
        
        edited = edit_short_video(
            video_path=downloaded,
            audio_path=args.audio,
            output_path=final_path,
            city_name=city_name,
            country_name=country_name,
            radio_name=args.radio_name,
            logo_path=logo_path,
            duration=args.duration,
        )
        
        if edited:
            print(f"\n✅ Vídeo final: {edited}")
            return 0
        else:
            print("\n❌ Falha ao editar vídeo")
            return 1
            
    except Exception as e:
        print(f"❌ Erro: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
