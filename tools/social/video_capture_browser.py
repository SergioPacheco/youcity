"""
Captura de vídeo via browser (Playwright).

Abre youcity.app/city/<slug> em modo mobile e grava a tela.
Mais confiável que yt-dlp para evitar bloqueios.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

try:
    from playwright.sync_api import sync_playwright, Browser, Page, Playwright, BrowserContext
except ImportError:
    print("❌ Playwright não instalado. Execute:")
    print("   pip install playwright")
    print("   playwright install chromium")
    sys.exit(1)

if __package__ in (None, ""):
    from audio_capture import capture_best_radio, get_city_radios
else:
    from .audio_capture import capture_best_radio, get_city_radios


def load_catalog() -> list[dict]:
    """Carrega catálogo de cidades."""
    catalog_path = Path(__file__).parent.parent.parent / "data" / "catalog.json"
    if not catalog_path.exists():
        raise FileNotFoundError(f"Catálogo não encontrado: {catalog_path}")
    
    with open(catalog_path, encoding="utf-8") as f:
        return json.load(f)


def mux_video_audio(video_path: Path, audio_path: Path, output_path: Path, duration: int) -> Optional[Path]:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y",
        "-i", str(video_path),
        "-i", str(audio_path),
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-t", str(duration),
        "-movflags", "+faststart",
        str(output_path),
    ]
    try:
        result = subprocess.run(cmd, timeout=max(60, duration * 4), capture_output=True, text=True, errors="replace")
    except (FileNotFoundError, subprocess.TimeoutExpired) as error:
        print(f"   ❌ Falha ao muxar áudio: {error}")
        return None
    if result.returncode != 0 or not output_path.exists() or output_path.stat().st_size == 0:
        print(f"   ❌ FFmpeg não conseguiu adicionar áudio: {result.stderr[-500:]}")
        return None
    return output_path


def capture_mobile_video(
    city_slug: str,
    duration: int = 30,
    output_dir: Optional[Path] = None,
    headless: bool = True,
    timeout: int = 30000,
    show_controls: bool = False,
) -> Optional[Path]:
    """
    Captura vídeo do youcity.app em modo mobile.
    
    Args:
        city_slug: Slug da cidade (ex: sao-paulo)
        duration: Duração da gravação em segundos
        output_dir: Diretório de saída
        headless: Executar em modo headless
        timeout: Timeout para carregamento em ms
    
    Returns:
        Path do vídeo ou None se falhou
    """
    if output_dir is None:
        from datetime import date
        output_dir = Path("out") / "shorts" / str(date.today())
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"🎬 Capturando vídeo via browser (mobile)...")
    print(f"   Cidade: {city_slug}")
    print(f"   Duração: {duration}s")
    print(f"   Modo: {'headless' if headless else 'headed'}")
    
    with sync_playwright() as p:
        # Configurar navegador mobile
        iphone_14_pro = p.devices["iPhone 14 Pro"]
        capture_viewport = {"width": 393, "height": 852}
        browser = p.chromium.launch(
            headless=headless,
            args=[
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--disable-setuid-sandbox",
                "--no-sandbox",
            ]
        )
        
        # Criar contexto mobile
        context = browser.new_context(
            **{**iphone_14_pro, "viewport": capture_viewport},
            record_video_dir=str(output_dir),
            record_video_size={"width": 393, "height": 852},  # iPhone 14 Pro
        )
        
        if show_controls:
            context.add_init_script("""
                window.localStorage.setItem("youcity_consent_v1", JSON.stringify({
                    version: 1,
                    consent: {
                        ad_storage: "denied",
                        analytics_storage: "denied",
                        ad_user_data: "denied",
                        ad_personalization: "denied"
                    },
                    timestamp: Date.now()
                }));
            """)
        page = context.new_page()
        
        try:
            # Navegar para a cidade
            base_url = os.environ.get("YOUCITY_SITE_URL", "https://youcity.app").rstrip("/")
            query = "mode=drone" if show_controls else "mode=drone&clean=1"
            url = f"{base_url}/city/{city_slug}?{query}"
            print(f"   📱 Abrindo: {url}")
            
            page.goto(url, timeout=timeout, wait_until="load")  # Mais rápido que networkidle
            
            # Aguardar carregamento do vídeo
            print("   ⏳ Aguardando player...")
            
            # Aguardar qualquer um: iframe do YouTube, video element, ou .video-container
            try:
                page.wait_for_selector("iframe[src*='youtube'], video, .video-container", timeout=timeout)
            except:
                print("   ⚠️  Player não detectado, continuando...")
            
            # Aguardar um pouco mais para o vídeo carregar
            time.sleep(3)
            
            if show_controls:
                radio_expand = page.locator("#radio-expand")
                if radio_expand.is_visible():
                    radio_expand.click()
                    time.sleep(2)
                more_button = page.locator("#more-button")
                if more_button.is_visible():
                    more_button.click()
                    time.sleep(2)

            # A URL já solicita o modo Drone; o clique é apenas fallback para páginas antigas.
            if not show_controls:
                try:
                    drone_button = page.query_selector("button[data-mode='drone'], button:has-text('Drone')")
                    if drone_button and drone_button.is_visible():
                        print("   🚁 Selecionando modo Drone...")
                        drone_button.click()
                        time.sleep(2)
                except Exception as e:
                    print(f"   ⚠️  Erro ao selecionar Drone: {e}")
            
            # Verificar se vídeo está reproduzindo
            video_state = page.evaluate("""
                () => {
                    // Verificar iframe do YouTube
                    const iframe = document.querySelector('iframe[src*="youtube"]');
                    if (iframe) {
                        return { type: 'youtube', ready: true };
                    }
                    
                    // Verificar elemento de vídeo
                    const video = document.querySelector('video');
                    if (video) {
                        return {
                            type: 'video',
                            paused: video.paused,
                            currentTime: video.currentTime,
                            duration: video.duration
                        };
                    }
                    
                    return { type: 'none' };
                }
            """)
            
            print(f"   📹 Estado do player: {video_state}")
            
            # Tentar iniciar reprodução se pausado
            if video_state.get("type") == "video" and video_state.get("paused"):
                print("   ▶️  Iniciando reprodução...")
                page.evaluate("document.querySelector('video')?.play()")
                time.sleep(1)
            
            # Gravar vídeo
            print(f"   ⏺️  Gravando por {duration} segundos...")
            
            # Scroll suave para simular interação
            for i in range(duration):
                if show_controls and i == 2:
                    more_button = page.locator("#more-button")
                    if more_button.is_visible():
                        more_button.click()
                if i > 0 and i % 5 == 0:  # Scroll a cada 5s
                    page.mouse.wheel(0, 100)
                time.sleep(1)
            
            print("   ✓ Gravação concluída")
            
        except Exception as e:
            print(f"   ❌ Erro durante captura: {e}")
            return None
        
        finally:
            # Fechar contexto (salva o vídeo)
            context.close()
            browser.close()
    
    # Encontrar vídeo salvo
    videos = list(output_dir.glob("*.webm"))
    
    if videos:
        # Pegar o mais recente
        saved_video = max(videos, key=lambda p: p.stat().st_mtime)
        
        # Renomear com slug da cidade
        final_path = output_dir / f"{city_slug}_mobile.webm"
        
        if saved_video != final_path:
            saved_video.rename(final_path)
        
        print(f"   ✓ Vídeo sem áudio salvo: {final_path}")
        print(f"   📊 Tamanho: {final_path.stat().st_size / 1024 / 1024:.1f} MB")

        catalog = load_catalog()
        radios = get_city_radios(catalog, city_slug)
        audio_path, radio_info = capture_best_radio(
            radios=radios,
            duration=duration,
            output_dir=output_dir,
        )
        if not audio_path:
            print("   ❌ Captura cancelada: não foi possível obter áudio da rádio")
            return None

        output_path = output_dir / f"{city_slug}_mobile.mp4"
        muxed_path = mux_video_audio(final_path, audio_path, output_path, duration)
        if not muxed_path:
            return None
        print(f"   ✓ Vídeo final com áudio salvo: {muxed_path}")
        print(f"   📻 Rádio: {radio_info.get('name', 'Unknown') if radio_info else 'Unknown'}")
        print(f"   📊 Tamanho: {muxed_path.stat().st_size / 1024 / 1024:.1f} MB")
        return muxed_path
    
    print("   ❌ Vídeo não foi salvo")
    return None


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Captura vídeo do YouCity via browser mobile"
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
    parser.add_argument(
        "--headed",
        action="store_true",
        help="Executar com interface gráfica"
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=30000,
        help="Timeout para carregamento em ms (default: 30000)"
    )
    parser.add_argument(
        "--show-controls",
        action="store_true",
        help="Mostrar barra superior, player e menu de opções na demonstração"
    )
    
    args = parser.parse_args()
    
    try:
        video_path = capture_mobile_video(
            city_slug=args.city,
            duration=args.duration,
            output_dir=args.output_dir,
            headless=not args.headed,
            timeout=args.timeout,
            show_controls=args.show_controls,
        )
        
        if video_path:
            print(f"\n✅ Sucesso!")
            print(f"   Vídeo: {video_path}")
            return 0
        else:
            print(f"\n❌ Falha ao capturar vídeo")
            return 1
            
    except Exception as e:
        print(f"❌ Erro: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
