#!/usr/bin/env python3
"""
Script de teste para video_capture.py.

Testa captura de vídeo com uma cidade que tem modo drone.
"""
import subprocess
import sys
from pathlib import Path

def test_video_capture():
    """Testa captura de vídeo com São Paulo (tem drone)."""
    print("🧪 Testando captura de vídeo...")
    print("   Cidade: São Paulo (tem modo drone)")
    print("   Duração: 10 segundos (teste rápido)")
    print()
    
    # Executar script de captura
    cmd = [
        sys.executable,
        "tools/social/video_capture.py",
        "--city", "sao-paulo",
        "--duration", "10",
        "--timeout", "20000",
    ]
    
    print(f"Executando: {' '.join(cmd)}")
    print()
    
    result = subprocess.run(cmd, cwd=Path(__file__).parent.parent)
    
    if result.returncode == 0:
        print("\n✅ Teste concluído com sucesso!")
        print("   Verifique o vídeo em: out/shorts/YYYY-MM-DD/sao-paulo_raw.webm")
    else:
        print(f"\n❌ Teste falhou com código: {result.returncode}")
    
    return result.returncode


def check_dependencies():
    """Verifica se dependências estão instaladas."""
    print("🔍 Verificando dependências...")
    
    missing = []
    
    try:
        import playwright
        print("   ✓ Playwright instalado")
    except ImportError:
        print("   ✗ Playwright NÃO instalado")
        missing.append("playwright")
    
    try:
        import ffmpeg
        print("   ✓ FFmpeg python instalado")
    except ImportError:
        print("   ✗ FFmpeg python NÃO instalado")
        missing.append("ffmpeg-python")
    
    # Verificar se ffmpeg binary está disponível
    try:
        result = subprocess.run(["ffmpeg", "-version"], capture_output=True)
        if result.returncode == 0:
            print("   ✓ FFmpeg binary disponível")
        else:
            print("   ✗ FFmpeg binary não encontrado")
            missing.append("ffmpeg (binary)")
    except FileNotFoundError:
        print("   ✗ FFmpeg binary não encontrado")
        missing.append("ffmpeg (binary)")
    
    print()
    
    if missing:
        print("❌ Dependências faltando:")
        for dep in missing:
            print(f"   - {dep}")
        print("\nPara instalar:")
        print("   pip install -r requirements-shorts.txt")
        print("   playwright install chromium")
        print("   # No Ubuntu/Debian: sudo apt install ffmpeg")
        return False
    
    print("✅ Todas dependências instaladas!")
    return True


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Testa captura de vídeo")
    parser.add_argument("--skip-deps", action="store_true", help="Pular verificação de dependências")
    
    args = parser.parse_args()
    
    if not args.skip_deps:
        if not check_dependencies():
            sys.exit(1)
        print()
    
    sys.exit(test_video_capture())
