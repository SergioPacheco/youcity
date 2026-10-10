#!/usr/bin/env python3
"""
Setup inicial para YouTube OAuth.

Gera arquivo credentials.json para uso com YouTube Data API v3.

Como usar:
1. Criar projeto no Google Cloud Console: https://console.cloud.google.com
2. Habilitar YouTube Data API v3
3. Criar OAuth 2.0 credentials (Desktop app)
4. Baixar client_secret.json
5. Executar este script: python tools/social/youtube_auth.py --client-secret client_secret.json
6. Autorizar no browser
7. Salvar credentials.json gerado
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.oauth2.credentials import Credentials
except ImportError:
    print("❌ google-auth-oauthlib não instalado. Execute:")
    print("   pip install google-auth-oauthlib google-api-python-client")
    sys.exit(1)

# Scopes necessários para YouTube
SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
]


def authorize_youtube(client_secret_path: Path, output_path: Path) -> None:
    """
    Autoriza app e gera credentials.json.
    
    Args:
        client_secret_path: Caminho para client_secret.json (do Google Cloud Console)
        output_path: Caminho para salvar credentials.json
    """
    print("🔐 Iniciando autorização do YouTube...")
    print(f"   Client secret: {client_secret_path}")
    print(f"   Output: {output_path}")
    print()
    
    # Carregar client secret
    if not client_secret_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {client_secret_path}")
    
    # Criar flow OAuth
    flow = InstalledAppFlow.from_client_secrets_file(
        str(client_secret_path),
        SCOPES
    )
    
    # Executar autorização (abre browser)
    print("🌐 Abrindo browser para autorização...")
    print("   1. Faça login na sua conta Google")
    print("   2. Autorize o app")
    print("   3. O browser fechará automaticamente")
    print()
    
    credentials = flow.run_local_server(port=0)
    
    # Salvar credentials
    creds_data = {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": credentials.scopes,
    }
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w") as f:
        json.dump(creds_data, f, indent=2)
    
    print()
    print("✅ Autorização concluída!")
    print(f"   Credentials salvas em: {output_path}")
    print()
    print("Para usar no GitHub Actions:")
    print(f"   1. Codificar para JSON: cat {output_path} | jq -c .")
    print("   2. Adicionar como secret YOUTUBE_CREDENTIALS_JSON")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Gera credentials.json para YouTube API"
    )
    parser.add_argument(
        "--client-secret",
        type=Path,
        default=Path("client_secret.json"),
        help="Caminho para client_secret.json (default: client_secret.json)"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("/tmp/credentials.json"),
        help="Caminho para credentials.json (default: /tmp/credentials.json)"
    )
    
    args = parser.parse_args()
    
    try:
        authorize_youtube(args.client_secret, args.output)
        return 0
    except Exception as e:
        print(f"\n❌ Erro: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
