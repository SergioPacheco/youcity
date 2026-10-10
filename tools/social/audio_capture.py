"""
Captura de áudio de streams de rádio para Facebook Shorts.

Usa FFmpeg para gravar stream de rádio em tempo real.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Optional


def load_catalog() -> list[dict]:
    """Carrega catálogo de cidades."""
    catalog_path = Path(__file__).parent.parent.parent / "data" / "catalog.json"
    if not catalog_path.exists():
        raise FileNotFoundError(f"Catálogo não encontrado: {catalog_path}")
    
    with open(catalog_path, encoding="utf-8") as f:
        return json.load(f)


def get_city_radios(catalog: list[dict], city_slug: str) -> list[dict]:
    """Retorna lista de rádios da cidade."""
    for city in catalog:
        slug = city.get("name", "").lower().replace(" ", "-")
        if slug == city_slug.lower():
            return city.get("radios", [])
    return []


def capture_radio_audio(
    stream_url: str,
    duration: int,
    output_path: Path,
    timeout: int = 35,
    bitrate: str = "192k",
) -> Optional[Path]:
    """
    Captura áudio de stream de rádio via FFmpeg.
    
    Args:
        stream_url: URL do stream (HLS, MP3, AAC, etc.)
        duration: Duração da gravação em segundos
        output_path: Caminho do arquivo de saída
        timeout: Timeout total em segundos (deve ser > duration)
        bitrate: Bitrate do MP3 de saída
    
    Returns:
        Path do arquivo gravado ou None se falhou
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    cmd = [
        "ffmpeg",
        "-y",  # Sobrescrever se existir
        "-i", stream_url,
        "-t", str(duration),
        "-acodec", "libmp3lame",
        "-ab", bitrate,
        "-ar", "44100",
        "-ac", "2",
        "-loglevel", "warning",
        str(output_path)
    ]
    
    try:
        result = subprocess.run(
            cmd,
            timeout=timeout,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print(f"   ⚠️  FFmpeg error: {result.stderr[:200]}")
            return None
        
        if output_path.exists() and output_path.stat().st_size > 0:
            return output_path
        
        return None
        
    except subprocess.TimeoutExpired:
        print(f"   ⚠️  Timeout ao capturar stream")
        return None
    except FileNotFoundError:
        print("   ❌ FFmpeg não encontrado. Instale: sudo apt install ffmpeg")
        raise


def capture_best_radio(
    radios: list[dict],
    duration: int,
    output_dir: Path,
    max_attempts: int = 3,
) -> tuple[Optional[Path], Optional[dict]]:
    """
    Tenta capturar áudio de múltiplas rádios, usando a primeira que funcionar.
    
    Args:
        radios: Lista de rádios com 'name' e 'url'
        duration: Duração da gravação
        output_dir: Diretório de saída
        max_attempts: Máximo de rádios a tentar
    
    Returns:
        (path do áudio, info da rádio) ou (None, None)
    """
    if not radios:
        print("   ⚠️  Nenhuma rádio disponível")
        return None, None
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    for attempt, radio in enumerate(radios[:max_attempts]):
        name = radio.get("name", "Unknown")
        url = radio.get("url", "")
        
        if not url:
            continue
        
        print(f"   📻 Tentando: {name}")
        print(f"      URL: {url[:60]}...")
        
        output_path = output_dir / f"radio_{attempt}.mp3"
        
        result = capture_radio_audio(
            stream_url=url,
            duration=duration,
            output_path=output_path,
            timeout=duration + 5,
        )
        
        if result:
            print(f"      ✓ Áudio capturado: {result.stat().st_size / 1024:.1f} KB")
            return result, radio
        
        print(f"      ✗ Falhou, tentando próxima...")
    
    print("   ❌ Nenhuma rádio funcionou")
    return None, None


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Captura áudio de rádio para shorts"
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
        help="Duração da gravação em segundos (default: 30)"
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
        catalog = load_catalog()
        
        # Obter rádios da cidade
        radios = get_city_radios(catalog, args.city)
        
        if not radios:
            print(f"❌ Nenhuma rádio encontrada para {args.city}")
            return 1
        
        print(f"📻 {len(radios)} rádio(s) encontrada(s)")
        
        # Capturar áudio
        audio_path, radio_info = capture_best_radio(
            radios=radios,
            duration=args.duration,
            output_dir=output_dir,
        )
        
        if audio_path:
            print(f"\n✅ Áudio capturado: {audio_path}")
            print(f"   Rádio: {radio_info.get('name', 'Unknown')}")
            return 0
        else:
            print("\n❌ Falha ao capturar áudio")
            return 1
            
    except Exception as e:
        print(f"❌ Erro: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
