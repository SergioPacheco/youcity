#!/usr/bin/env python3
"""
Setup inicial para TikTok OAuth.

Obtém access_token e open_id para TikTok Content Posting API.

IMPORTANTE: TikTok precisa aprovar seu app antes de usar a API.
Registrar em: https://developers.tiktok.com

Como usar:
1. Registrar app no TikTok for Developers
2. Solicitar aprovação para Content Posting API
3. Após aprovação, obter client_key e client_secret
4. Executar este script: python tools/social/tiktok_auth.py --client-key xxx --client-secret xxx
5. Autorizar no browser
6. Salvar access_token e open_id
"""
from __future__ import annotations

import argparse
import json
import sys
import webbrowser
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import requests


class TikTokAuthError(RuntimeError):
    pass


def get_tiktok_auth_url(client_key: str, redirect_uri: str = "http://localhost:8080") -> str:
    """
    Gera URL de autorização do TikTok.
    
    Args:
        client_key: Client key do app TikTok
        redirect_uri: URI de redirecionamento (deve estar configurado no app)
    
    Returns:
        URL de autorização
    """
    base_url = "https://www.tiktok.com/v2/auth/authorize/"
    
    params = {
        "client_key": client_key,
        "response_type": "code",
        "scope": "user.info.basic,video.upload",
        "redirect_uri": redirect_uri,
        "state": "youcity_auth",
    }
    
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{base_url}?{query}"


def exchange_code_for_token(
    code: str,
    client_key: str,
    client_secret: str,
) -> dict:
    """
    Troca código de autorização por access token.
    
    Args:
        code: Código de autorização
        client_key: Client key do app
        client_secret: Client secret do app
    
    Returns:
        Dict com access_token, refresh_token, open_id, etc.
    """
    url = "https://open-api.tiktok.com/oauth/access_token/"
    
    data = {
        "client_key": client_key,
        "client_secret": client_secret,
        "code": code,
        "grant_type": "authorization_code",
    }
    
    response = requests.post(url, data=data, timeout=30)
    
    if response.status_code != 200:
        raise TikTokAuthError(f"Token exchange failed: {response.status_code} {response.text}")
    
    result = response.json()
    
    if result.get("data", {}).get("error_code", 0) != 0:
        error = result.get("data", {}).get("error_msg", "Unknown error")
        raise TikTokAuthError(f"TikTok API error: {error}")
    
    return result.get("data", {})


def authorize_tiktok(client_key: str, client_secret: str) -> None:
    """
    Fluxo completo de autorização TikTok.
    
    Args:
        client_key: Client key do app
        client_secret: Client secret do app
    """
    print("🔐 Iniciando autorização do TikTok...")
    print()
    
    # Gerar URL de autorização
    auth_url = get_tiktok_auth_url(client_key)
    
    print("🌐 Abrindo browser para autorização...")
    print("   1. Faça login na sua conta TikTok")
    print("   2. Autorize o app")
    print("   3. Copie o código da URL de redirecionamento")
    print()
    print(f"   URL: {auth_url}")
    print()
    
    # Abrir browser
    webbrowser.open(auth_url)
    
    # Solicitar código manualmente (TikTok não suporta callback local)
    print("⚠️  Após autorizar no browser, você será redirecionado para uma URL como:")
    print("   http://localhost:8080/?code=XXXXX&state=youcity_auth")
    print()
    code = input("Cole o código aqui: ").strip()
    
    if not code:
        print("❌ Código não fornecido")
        return
    
    # Trocar código por token
    print("\n🔄 Trocando código por token...")
    
    token_data = exchange_code_for_token(code, client_key, client_secret)
    
    access_token = token_data.get("access_token", "")
    refresh_token = token_data.get("refresh_token", "")
    open_id = token_data.get("open_id", "")
    
    print()
    print("✅ Autorização concluída!")
    print()
    print("Credentials:")
    print(f"   TIKTOK_ACCESS_TOKEN={access_token}")
    print(f"   TIKTOK_OPEN_ID={open_id}")
    print(f"   TIKTOK_REFRESH_TOKEN={refresh_token}")
    print()
    print("Para usar no GitHub Actions:")
    print("   1. Adicionar TIKTOK_ACCESS_TOKEN como secret")
    print("   2. Adicionar TIKTOK_OPEN_ID como secret")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Gera access_token para TikTok API"
    )
    parser.add_argument(
        "--client-key",
        required=True,
        help="Client key do app TikTok"
    )
    parser.add_argument(
        "--client-secret",
        required=True,
        help="Client secret do app TikTok"
    )
    
    args = parser.parse_args()
    
    try:
        authorize_tiktok(args.client_key, args.client_secret)
        return 0
    except Exception as e:
        print(f"\n❌ Erro: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
