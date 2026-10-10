#!/usr/bin/env python3
"""
Script de teste para YouCity Shorts.

Testa todo o pipeline:
1. Seleção de cidade
2. Download de vídeo
3. Captura de rádio
4. Edição
5. (Opcional) Publicação
"""
import subprocess
import sys
from pathlib import Path

# Adicionar path do projeto
sys.path.insert(0, str(Path(__file__).parent.parent))

# Carregar .env para testes locais
from tools.social.load_env import load_env
load_env()


def check_dependencies():
    """Verifica se todas as dependências estão instaladas."""
    print("🔍 Verificando dependências...\n")
    
    missing = []
    
    # Python packages
    packages = {
        "yt_dlp": "yt-dlp",
        "ffmpeg": "ffmpeg-python",
        "requests": "requests",
        "PIL": "Pillow",
    }
    
    for module, package in packages.items():
        try:
            __import__(module)
            print(f"   ✓ {package}")
        except ImportError:
            print(f"   ✗ {package} NÃO instalado")
            missing.append(package)
    
    # google-api-python-client (opcional)
    try:
        from google.oauth2.credentials import Credentials
        print("   ✓ google-api-python-client")
    except ImportError:
        print("   ⚠️  google-api-python-client NÃO instalado (YouTube Shorts opcional)")
    
    # FFmpeg binary
    try:
        result = subprocess.run(["ffmpeg", "-version"], capture_output=True)
        if result.returncode == 0:
            print("   ✓ FFmpeg binary")
        else:
            print("   ✗ FFmpeg binary não funciona")
            missing.append("ffmpeg (binary)")
    except FileNotFoundError:
        print("   ✗ FFmpeg binary não encontrado")
        missing.append("ffmpeg (binary)")
    
    print()
    
    if missing:
        print("❌ Dependências faltando:\n")
        for dep in missing:
            print(f"   - {dep}")
        print("\nPara instalar:\n")
        print("   pip install -r requirements-shorts.txt")
        print("   # Ubuntu/Debian:")
        print("   sudo apt install ffmpeg")
        return False
    
    print("✅ Todas dependências instaladas!\n")
    return True


def test_city_selection():
    """Testa seleção de cidade."""
    print("=" * 60)
    print("TESTE 1: Seleção de cidade com drone")
    print("=" * 60)
    
    cmd = [sys.executable, "-c", """
import sys
sys.path.insert(0, 'tools/social')
from shorts_daily import load_catalog, select_city_for_short
from utils import city_slug, display_city_name

catalog = load_catalog()
city = select_city_for_short(catalog, recent_days=0)  # Ignorar anti-duplicate

print(f"Cidade: {display_city_name(city)}")
print(f"Slug: {city_slug(city)}")
print(f"Drone: {'✓' if city.get('videos', {}).get('drone') else '✗'}")
"""]
    
    result = subprocess.run(cmd, cwd=Path(__file__).parent.parent)
    print()
    return result.returncode == 0


def test_video_download():
    """Testa download de vídeo do YouTube."""
    print("=" * 60)
    print("TESTE 2: Download de vídeo (10s)")
    print("=" * 60)
    
    cmd = [
        sys.executable,
        "tools/social/video_editor.py",
        "--city", "sao-paulo",
        "--duration", "10",
    ]
    
    result = subprocess.run(cmd, cwd=Path(__file__).parent.parent)
    print()
    return result.returncode == 0


def test_audio_capture():
    """Testa captura de áudio de rádio."""
    print("=" * 60)
    print("TESTE 3: Captura de áudio (5s)")
    print("=" * 60)
    
    cmd = [
        sys.executable,
        "tools/social/audio_capture.py",
        "--city", "sao-paulo",
        "--duration", "5",
    ]
    
    result = subprocess.run(cmd, cwd=Path(__file__).parent.parent)
    print()
    return result.returncode == 0


def test_full_pipeline():
    """Testa pipeline completo (sem publicar)."""
    print("=" * 60)
    print("TESTE 4: Pipeline completo (generate-only)")
    print("=" * 60)
    
    cmd = [
        sys.executable,
        "tools/social/shorts_daily.py",
        "--city", "sao-paulo",
        "--duration", "10",
        "--generate-only",
    ]
    
    result = subprocess.run(cmd, cwd=Path(__file__).parent.parent)
    print()
    return result.returncode == 0


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Testa YouCity Shorts")
    parser.add_argument("--skip-deps", action="store_true", help="Pular verificação de dependências")
    parser.add_argument("--test", choices=["selection", "video", "audio", "full"], help="Executar teste específico")
    
    args = parser.parse_args()
    
    if not args.skip_deps:
        if not check_dependencies():
            return 1
    
    if args.test == "selection":
        return 0 if test_city_selection() else 1
    elif args.test == "video":
        return 0 if test_video_download() else 1
    elif args.test == "audio":
        return 0 if test_audio_capture() else 1
    elif args.test == "full":
        return 0 if test_full_pipeline() else 1
    
    # Rodar todos os testes
    print("🧪 Executando todos os testes...\n")
    
    tests = [
        ("Seleção de cidade", test_city_selection),
        ("Download de vídeo", test_video_download),
        ("Captura de áudio", test_audio_capture),
        ("Pipeline completo", test_full_pipeline),
    ]
    
    results = []
    
    for name, test_func in tests:
        try:
            success = test_func()
            results.append((name, success))
        except Exception as e:
            print(f"❌ Erro no teste '{name}': {e}\n")
            results.append((name, False))
    
    # Resumo
    print("=" * 60)
    print("📊 RESUMO DOS TESTES")
    print("=" * 60)
    
    for name, success in results:
        status = "✅ PASSOU" if success else "❌ FALHOU"
        print(f"{name:.<40} {status}")
    
    print("=" * 60)
    
    all_passed = all(success for _, success in results)
    
    if all_passed:
        print("\n✅ Todos os testes passaram!")
        print("\nPróximos passos:")
        print("   1. Configurar secrets no GitHub:")
        print("      - FB_SYSTEM_USER_TOKEN")
        print("      - FACEBOOK_PAGE_ID")
        print("      - YOUTUBE_CREDENTIALS_JSON")
        print("      - TIKTOK_ACCESS_TOKEN")
        print("      - TIKTOK_OPEN_ID")
        print("   2. Testar publicação manual:")
        print("      python tools/social/shorts_daily.py --city sao-paulo --duration 30")
        print("   3. Ativar workflow no GitHub Actions")
    else:
        print("\n❌ Alguns testes falharam. Verifique os logs acima.")
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
