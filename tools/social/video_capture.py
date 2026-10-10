"""
Captura de vídeo do YouCity para Facebook Shorts.

Usa Playwright para abrir a página da cidade, selecionar modo drone
e gravar a tela por N segundos.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Optional

try:
    from playwright.sync_api import sync_playwright, Browser, Page, Playwright
except ImportError:
    print("❌ Playwright não instalado. Execute:")
    print("   pip install playwright")
    print("   playwright install chromium")
    sys.exit(1)


def load_catalog() -> list[dict]:
    """Carrega catálogo de cidades."""
    catalog_path = Path(__file__).parent.parent.parent / "data" / "catalog.json"
    if not catalog_path.exists():
        raise FileNotFoundError(f"Catálogo não encontrado: {catalog_path}")
    
    with open(catalog_path, encoding="utf-8") as f:
        return json.load(f)


def find_city_with_drone(catalog: list[dict], slug: Optional[str] = None) -> dict:
    """
    Encontra cidade com modo drone disponível.
    
    Se slug fornecido, retorna essa cidade (se tiver drone).
    Se não, retorna primeira cidade com drone.
    """
    for city in catalog:
        city_slug = city.get("name", "").lower().replace(" ", "-")
        
        # Se slug especificado, verificar se é essa cidade
        if slug and city_slug != slug.lower():
            continue
        
        # Verificar se tem modo drone
        videos = city.get("videos", {})
        drone_videos = videos.get("drone", [])
        
        if drone_videos:
            return city
    
    raise ValueError(
        f"Cidade {'especificada não tem modo drone' if slug else 'com modo drone não encontrada'}"
    )


def capture_drone_video(
    city_slug: str,
    duration: int = 30,
    output_dir: Optional[Path] = None,
    headless: bool = True,
    timeout: int = 15000,
    viewport_width: int = 1080,
    viewport_height: int = 1920,
) -> Path:
    """
    Captura vídeo do modo drone de uma cidade.
    
    Args:
        city_slug: Slug da cidade (ex: "sao-paulo")
        duration: Duração da gravação em segundos
        output_dir: Diretório de saída (default: out/shorts/YYYY-MM-DD)
        headless: Executar navegador em modo headless
        timeout: Timeout para carregamento em ms
        viewport_width: Largura da viewport
        viewport_height: Altura da viewport (1920 para formato vertical)
    
    Returns:
        Path do arquivo de vídeo gravado
    """
    # Diretório de saída
    if output_dir is None:
        from datetime import date
        output_dir = Path("out") / "shorts" / str(date.today())
    
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{city_slug}_raw.webm"
    
    print(f"🎬 Capturando vídeo de {city_slug}...")
    print(f"   Duração: {duration}s")
    print(f"   Saída: {output_path}")
    
    with sync_playwright() as p:
        # Iniciar navegador
        browser = p.chromium.launch(
            headless=headless,
            args=[
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--disable-setuid-sandbox",
                "--no-sandbox",
            ]
        )
        
        # Configurar contexto de gravação
        context = browser.new_context(
            viewport={"width": viewport_width, "height": viewport_height},
            record_video_dir=str(output_dir),
            record_video_size={"width": viewport_width, "height": viewport_height},
        )
        
        page = context.new_page()
        
        try:
            # Navegar para a página da cidade
            url = f"https://youcity.app/city/{city_slug}"
            print(f"   Navegando para: {url}")
            page.goto(url, timeout=timeout, wait_until="networkidle")
            
            # Aguardar player de vídeo carregar
            print("   Aguardando player de vídeo...")
            page.wait_for_selector("#video-player, .video-container, iframe[src*='youtube']", timeout=timeout)
            
            # Tentar clicar no modo drone
            try:
                print("   Selecionando modo Drone...")
                drone_button = page.query_selector("button[data-mode='drone'], button:has-text('Drone')")
                if drone_button:
                    drone_button.click()
                    # Aguardar troca de vídeo
                    time.sleep(3)
                else:
                    print("   ⚠️  Botão Drone não encontrado, usando vídeo padrão")
            except Exception as e:
                print(f"   ⚠️  Erro ao selecionar drone: {e}")
            
            # Aguardar vídeo começar a reproduzir
            print("   Aguardando início da reprodução...")
            time.sleep(2)
            
            # Verificar se vídeo está reproduzindo
            video_state = page.evaluate("""
                () => {
                    const video = document.querySelector('video');
                    if (video) {
                        return {
                            paused: video.paused,
                            currentTime: video.currentTime,
                            duration: video.duration
                        };
                    }
                    return null;
                }
            """)
            
            if video_state:
                print(f"   Estado do vídeo: {video_state}")
                if video_state.get("paused"):
                    print("   ⚠️  Vídeo pausado, tentando reproduzir...")
                    page.evaluate("document.querySelector('video')?.play()")
                    time.sleep(1)
            else:
                print("   ⚠️  Elemento de vídeo não detectado")
            
            # Gravar pelo tempo especificado
            print(f"   📹 Gravando por {duration} segundos...")
            time.sleep(duration)
            
            print("   ✓ Gravação concluída")
            
        except Exception as e:
            print(f"   ❌ Erro durante captura: {e}")
            raise
        
        finally:
            # Fechar contexto e navegador (isso salva o vídeo)
            context.close()
            browser.close()
    
    # Verificar se vídeo foi salvo
    # Playwright salva com nome aleatório, então precisamos encontrar
    videos = list(output_dir.glob("*.webm"))
    if videos:
        # Pegar o mais recente
        saved_video = max(videos, key=lambda p: p.stat().st_mtime)
        
        # Renomear para o nome esperado
        if saved_video != output_path:
            saved_video.rename(output_path)
        
        print(f"   ✓ Vídeo salvo: {output_path} ({output_path.stat().st_size / 1024 / 1024:.1f} MB)")
        return output_path
    
    raise RuntimeError("Vídeo não foi salvo")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Captura vídeo do YouCity para Facebook Shorts"
    )
    parser.add_argument(
        "--city",
        metavar="SLUG",
        help="Slug da cidade (ex: sao-paulo). Se omitido, usa primeira com drone."
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
        help="Executar navegador com interface gráfica"
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=15000,
        help="Timeout para carregamento em ms (default: 15000)"
    )
    
    args = parser.parse_args()
    
    try:
        # Carregar catálogo
        print("📚 Carregando catálogo...")
        catalog = load_catalog()
        print(f"   {len(catalog)} cidades encontradas")
        
        # Encontrar cidade com drone
        city = find_city_with_drone(catalog, args.city)
        city_slug = city.get("name", "").lower().replace(" ", "-")
        city_name = city.get("name", "Unknown")
        city_country = city.get("country", "Unknown")
        
        print(f"✓ Cidade selecionada: {city_name}, {city_country}")
        print(f"   Slug: {city_slug}")
        
        # Verificar se tem rádio
        radios = city.get("radios", [])
        if radios:
            print(f"   📻 {len(radios)} rádio(s) disponível(is)")
        else:
            print("   ⚠️  Nenhuma rádio disponível")
        
        # Capturar vídeo
        video_path = capture_drone_video(
            city_slug=city_slug,
            duration=args.duration,
            output_dir=args.output_dir,
            headless=not args.headed,
            timeout=args.timeout,
        )
        
        print(f"\n✅ Sucesso! Vídeo capturado: {video_path}")
        return 0
        
    except FileNotFoundError as e:
        print(f"❌ Arquivo não encontrado: {e}")
        return 1
    except ValueError as e:
        print(f"❌ Erro de validação: {e}")
        return 1
    except Exception as e:
        print(f"❌ Erro inesperado: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
