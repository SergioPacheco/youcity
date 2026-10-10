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
    try:
        from video_editor import build_branding_filter
    except ImportError:
        build_branding_filter = None  # type: ignore
else:
    from .audio_capture import capture_best_radio, get_city_radios
    try:
        from .video_editor import build_branding_filter
    except ImportError:
        build_branding_filter = None  # type: ignore


LOGO_PATH = Path(__file__).parent.parent.parent / "assets" / "logo-youcity.png"

# Warm-up: tempo mínimo após a navegação para o YouTube conectar antes do
# trecho aproveitado. O Playwright grava desde a criação da página, então o
# loading inicial é descartado via -ss no mux (ver video_skip).


def load_catalog() -> list[dict]:
    """Carrega catálogo de cidades."""
    catalog_path = Path(__file__).parent.parent.parent / "data" / "catalog.json"
    if not catalog_path.exists():
        raise FileNotFoundError(f"Catálogo não encontrado: {catalog_path}")
    
    with open(catalog_path, encoding="utf-8") as f:
        return json.load(f)


WARMUP_SECONDS = 10.0


def mux_video_audio(video_path: Path, audio_path: Path, output_path: Path, duration: int, video_skip: float = 0.0) -> Optional[Path]:
    """Muxa vídeo (descartando `video_skip` s iniciais de loading) + áudio da rádio."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{max(0.0, video_skip):.1f}",
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


def add_branding_overlay(
    video_path: Path,
    city_name: str,
    country_name: str,
    output_path: Path,
    logo_path: Optional[Path] = None,
    radio_name: Optional[str] = None,
) -> Optional[Path]:
    """
    Adiciona branding fixo no topo: logo bem pequeno centralizado + nome da cidade abaixo.

    Usado porque a captura usa ?clean=1 (esconde topbar/city-intro/brand-logo do site).
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    logo_path = logo_path or LOGO_PATH

    # Fonte (mesma do video_editor / CI)
    font_candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    font_file = next((p for p in font_candidates if Path(p).exists()), None)

    if build_branding_filter is not None:
        drawtext_filters, logo_scale_filter, _ = build_branding_filter(
            city_name=city_name,
            country_name=country_name,
            radio_name=None,  # rádio já está no áudio; não poluir o topo
            font_file=font_file,
        )
    else:  # fallback mínimo (sem import)
        safe_city = f"{city_name} – {country_name}".replace(":", "\\:").replace("'", "\\'")
        font_opt = f":fontfile={font_file}" if font_file else ""
        drawtext_filters = [
            f"drawtext=text='{safe_city}':fontsize=28:fontcolor=white:"
            f"x=(w-text_w)/2:y=66:box=1:boxcolor=black@0.45:boxborderw=10:"
            f"shadowcolor=black@0.6:shadowx=1:shadowy=1{font_opt}"
        ]
        logo_scale_filter = "scale=120:-1:flags=lanczos,format=rgba"

    has_logo = bool(logo_path and logo_path.exists())
    if has_logo:
        assert logo_path is not None
        video_filter = (
            f"[0:v]{','.join(drawtext_filters)}[vtext];"
            f"[1:v]{logo_scale_filter}[logo];"
            f"[vtext][logo]overlay=(W-w)/2:12:format=auto,format=yuv420p[v]"
        )
        cmd = [
            "ffmpeg", "-y",
            "-i", str(video_path),
            "-i", str(logo_path),
            "-filter_complex", video_filter,
            "-map", "[v]", "-map", "0:a?",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            str(output_path),
        ]
    else:
        print("   ⚠️  Logo não encontrado, aplicando só texto da cidade")
        video_filter = f"[0:v]{','.join(drawtext_filters)},format=yuv420p[v]"
        cmd = [
            "ffmpeg", "-y",
            "-i", str(video_path),
            "-filter_complex", video_filter,
            "-map", "[v]", "-map", "0:a?",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            str(output_path),
        ]

    print(f"   🏷️  Aplicando branding: {city_name} + logo topo")
    try:
        result = subprocess.run(cmd, timeout=120, capture_output=True, text=True, errors="replace")
    except (FileNotFoundError, subprocess.TimeoutExpired) as error:
        print(f"   ❌ Falha no branding: {error}")
        return None
    if result.returncode != 0 or not output_path.exists() or output_path.stat().st_size == 0:
        print(f"   ❌ FFmpeg branding falhou: {result.stderr[-500:]}")
        return None
    print(f"   ✓ Branding aplicado: {output_path.stat().st_size / 1024 / 1024:.1f} MB")
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
        t_page_created = time.time()  # gravação do Playwright começa aqui
        video_skip = 0.0
        
        try:
            # Navegar para a cidade
            base_url = os.environ.get("YOUCITY_SITE_URL", "https://youcity.app").rstrip("/")
            query = "mode=drone" if show_controls else "mode=drone&clean=1"
            url = f"{base_url}/city/{city_slug}?{query}"
            print(f"   📱 Abrindo: {url}")
            
            t_nav_start = time.time()
            page.goto(url, timeout=timeout, wait_until="load")  # Mais rápido que networkidle
            
            # Aguardar carregamento do vídeo
            print("   ⏳ Aguardando player...")
            
            # Aguardar qualquer um: iframe do YouTube, video element, ou .video-container
            try:
                page.wait_for_selector("iframe[src*='youtube'], video, .video-container", timeout=timeout)
            except:
                print("   ⚠️  Player não detectado, continuando...")
            
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

            # Warm-up: aguardar o YouTube conectar antes do trecho aproveitado.
            # A gravação já roda desde t_page_created; o loading será cortado
            # via video_skip no mux.
            elapsed_nav = time.time() - t_nav_start
            remaining = WARMUP_SECONDS - elapsed_nav
            if remaining > 0:
                print(f"   ⏳ Warm-up: aguardando {remaining:.0f}s p/ YouTube conectar...")
                time.sleep(remaining)

            # Marcar início do conteúdo (tudo antes disso é descartado)
            video_skip = time.time() - t_page_created
            print(f"   ✂️  Descartando {video_skip:.1f}s iniciais (loading)")

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
        muxed_path = mux_video_audio(final_path, audio_path, output_path, duration, video_skip=video_skip)
        if not muxed_path:
            return None
        print(f"   ✓ Vídeo final com áudio salvo: {muxed_path}")
        print(f"   📻 Rádio: {radio_info.get('name', 'Unknown') if radio_info else 'Unknown'}")
        print(f"   📊 Tamanho: {muxed_path.stat().st_size / 1024 / 1024:.1f} MB")

        # Branding no topo (clean=1 esconde nome/logo do site): não bloqueia entrega
        try:
            city_info = next(
                (c for c in catalog
                 if str(c.get("name", "")).lower().replace(" ", "-") == city_slug.lower()),
                None,
            )
            try:
                # Import estilo pacote (funciona como script e como módulo).
                # `from utils import` direto quebra porque utils.py usa import relativo.
                sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
                from social.utils import display_city_name, display_country_name
                city_name = display_city_name(city_info) if city_info else city_slug.replace("-", " ").title()
                country_name = display_country_name(city_info) if city_info else ""
            except Exception:
                city_name = str((city_info or {}).get("name") or city_slug.replace("-", " ").title())
                country_name = str((city_info or {}).get("country") or "")
            branded_path = output_dir / f"{city_slug}_branded.mp4"
            branded = add_branding_overlay(
                video_path=muxed_path,
                city_name=city_name,
                country_name=country_name,
                output_path=branded_path,
            )
            if branded:
                branded.replace(muxed_path)  # mantém nome final *_mobile.mp4
                print(f"   ✓ Vídeo com branding: {muxed_path}")
        except Exception as e:
            print(f"   ⚠️  Branding pulado: {e}")

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
