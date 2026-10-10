"""
Publishers para Facebook Reels, YouTube Shorts e TikTok.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Optional

import requests


class PublisherError(RuntimeError):
    """Erro genérico de publisher."""
    pass


# =============================================================================
# FACEBOOK REELS
# =============================================================================

class FacebookReelsPublisher:
    """
    Publisher para Facebook Reels via Graph API.
    
    Docs: https://developers.facebook.com/docs/video-api/guides/publishing
    """
    
    def __init__(self, access_token: str, api_version: str = "v23.0"):
        self.access_token = access_token
        self.api_version = api_version
        self.base_url = f"https://graph.facebook.com/{api_version}"
    
    def upload_reel(
        self,
        page_id: str,
        video_path: Path,
        title: str,
        description: Optional[str] = None,
    ) -> str:
        """
        Upload de vídeo como Facebook Reel.
        
        Args:
            page_id: ID da página do Facebook
            video_path: Caminho do arquivo de vídeo
            title: Título do reel
            description: Descrição (opcional)
        
        Returns:
            ID do post publicado
        """
        # Obter Page Access Token a partir do System User Token
        page_token = self._get_page_access_token(page_id)
        
        # Endpoint correto para Reels: /{page_id}/videos
        url = f"{self.base_url}/{page_id}/videos"
        
        with open(video_path, "rb") as video_file:
            files = {"source": (video_path.name, video_file, "video/mp4")}
            data = {
                "access_token": page_token,  # Usar Page Token, não System User Token
                "title": title,
                "description": description or title,
            }
            
            print(f"   📤 Publicando no Facebook Reels...")
            print(f"      Página: {page_id}")
            
            response = requests.post(url, files=files, data=data, timeout=120)
        
        if response.status_code != 200:
            error_msg = response.text[:500]
            print(f"   ❌ Erro Facebook: {error_msg}")
            raise PublisherError(f"Facebook API {response.status_code}: {error_msg}")
        
        result = response.json()
        post_id = result.get("id") or result.get("post_id", "")
        
        print(f"      ✓ Publicado: {post_id}")
        return post_id
    
    def _get_page_access_token(self, page_id: str) -> str:
        """
        Obtém Page Access Token a partir do System User Token.
        
        Na nova experiência de Páginas, o System User Token precisa ser
        trocado por um Page Access Token via /me/accounts.
        """
        url = f"{self.base_url}/me/accounts"
        params = {"access_token": self.access_token}
        
        response = requests.get(url, params=params, timeout=30)
        
        if response.status_code != 200:
            raise PublisherError(f"Failed to get page token: {response.text[:200]}")
        
        result = response.json()
        
        # Encontrar a página pelo ID
        for page in result.get("data", []):
            if page.get("id") == page_id:
                return page.get("access_token", "")
        
        # Se não encontrou, pode ser que o System User tenha acesso direto
        # Tentar usar o próprio token
        print("   ⚠️  Page token não encontrado, usando System User Token")
        return self.access_token


# =============================================================================
# YOUTUBE SHORTS
# =============================================================================

class YouTubeShortsPublisher:
    """
    Publisher para YouTube Shorts via YouTube Data API v3.
    
    Docs: https://developers.google.com/youtube/v3/docs/videos/insert
    
    Requer:
    - OAuth2 credentials (client_secret.json)
    - Refresh token
    """
    
    def __init__(self, credentials_path: Path):
        self.credentials_path = credentials_path
        
        # Verificar se google-api-python-client está instalado
        try:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build
            from googleapiclient.http import MediaFileUpload
            self.Credentials = Credentials
            self.build = build
            self.MediaFileUpload = MediaFileUpload
        except ImportError:
            raise ImportError(
                "google-api-python-client não instalado. "
                "Execute: pip install google-api-python-client google-auth-oauthlib"
            )
    
    def upload_short(
        self,
        video_path: Path,
        title: str,
        description: Optional[str] = None,
        tags: Optional[list[str]] = None,
        category_id: str = "19",  # Travel
    ) -> str:
        """
        Upload de vídeo como YouTube Short.
        
        Args:
            video_path: Caminho do arquivo de vídeo
            title: Título do vídeo
            description: Descrição (opcional)
            tags: Tags/keywords (opcional)
            category_id: ID da categoria (default: 19 = Travel)
        
        Returns:
            ID do vídeo publicado
        """
        # Carregar credenciais
        creds = self.Credentials.from_authorized_user_file(str(self.credentials_path))
        
        # Criar serviço YouTube
        youtube = self.build("youtube", "v3", credentials=creds)
        
        # Metadados do vídeo
        body = {
            "snippet": {
                "title": title[:100],  # Limite YouTube
                "description": description or title,
                "tags": tags or [],
                "categoryId": category_id,
            },
            "status": {
                "privacyStatus": "public",
                "selfDeclaredMadeForKids": False,
                # Shorts são identificados automaticamente pelo aspect ratio (9:16)
            }
        }
        
        # Upload
        media = self.MediaFileUpload(
            str(video_path),
            mimetype="video/mp4",
            resumable=True,
        )
        
        print(f"   📤 Publicando no YouTube Shorts...")
        print(f"      Título: {title[:50]}...")
        
        request = youtube.videos().insert(
            part="snippet,status",
            body=body,
            media_body=media,
        )
        
        response = None
        while response is None:
            status, response = request.next_chunk()
            if status:
                progress = int(status.progress() * 100)
                print(f"      Progresso: {progress}%")
        
        video_id = response.get("id", "")
        
        print(f"      ✓ Publicado: https://youtube.com/shorts/{video_id}")
        return video_id


# =============================================================================
# TIKTOK
# =============================================================================

class TikTokPublisher:
    """
    Publisher para TikTok via Content Posting API.
    
    Docs: https://developers.tiktok.com/doc/content-posting-api-get-started
    
    Requer:
    - Access token (OAuth2)
    - Open ID do criador
    """
    
    def __init__(self, access_token: str, open_id: str):
        self.access_token = access_token
        self.open_id = open_id
        self.base_url = "https://open-api.tiktok.com"
    
    def upload_short(
        self,
        video_path: Path,
        title: str,
        privacy_level: str = "PUBLIC_TO_EVERYONE",
    ) -> str:
        """
        Upload de vídeo para TikTok.
        
        Args:
            video_path: Caminho do arquivo de vídeo
            title: Título/caption (máx 150 caracteres)
            privacy_level: PUBLIC_TO_EVERYONE, PUBLIC_TO_FOLLOWERS, etc.
        
        Returns:
            ID do vídeo publicado
        """
        url = f"{self.base_url}/share/video/upload/"
        
        with open(video_path, "rb") as video_file:
            files = {"video": video_file}
            data = {
                "access_token": self.access_token,
                "open_id": self.open_id,
                "title": title[:150],  # Limite TikTok
            }
            
            print(f"   📤 Publicando no TikTok...")
            print(f"      Título: {title[:50]}...")
            
            response = requests.post(url, files=files, data=data, timeout=120)
        
        if response.status_code != 200:
            error_msg = response.text[:500]
            print(f"   ❌ Erro TikTok: {error_msg}")
            raise PublisherError(f"TikTok API {response.status_code}: {error_msg}")
        
        result = response.json()
        
        # Verificar resposta
        if result.get("data", {}).get("error_code", 0) != 0:
            error_msg = result.get("data", {}).get("message", "Unknown error")
            print(f"   ❌ Erro TikTok: {error_msg}")
            raise PublisherError(f"TikTok API error: {error_msg}")
        
        video_id = result.get("data", {}).get("video_id", "")
        
        print(f"      ✓ Publicado: {video_id}")
        return video_id


# =============================================================================
# MULTIPUBLISHER (conveniência)
# =============================================================================

class MultiPublisher:
    """
    Publica em múltiplas plataformas com uma chamada.
    """
    
    def __init__(
        self,
        facebook_token: Optional[str] = None,
        youtube_credentials: Optional[Path] = None,
        tiktok_token: Optional[str] = None,
        tiktok_open_id: Optional[str] = None,
    ):
        self.facebook = FacebookReelsPublisher(facebook_token) if facebook_token else None
        self.youtube = YouTubeShortsPublisher(youtube_credentials) if youtube_credentials else None
        self.tiktok = TikTokPublisher(tiktok_token, tiktok_open_id) if tiktok_token and tiktok_open_id else None
    
    def publish_all(
        self,
        video_path: Path,
        title: str,
        description: Optional[str] = None,
        tags: Optional[list[str]] = None,
        facebook_page_id: Optional[str] = None,
    ) -> dict[str, str]:
        """
        Publica em todas as plataformas configuradas.
        
        Args:
            video_path: Caminho do vídeo
            title: Título
            description: Descrição (opcional)
            tags: Tags/hashtags (opcional)
            facebook_page_id: ID da página do Facebook
        
        Returns:
            Dict com platform -> post_id
        """
        results = {}
        
        # Facebook
        if self.facebook and facebook_page_id:
            try:
                results["facebook"] = self.facebook.upload_reel(
                    page_id=facebook_page_id,
                    video_path=video_path,
                    title=title,
                    description=description,
                )
            except PublisherError as e:
                results["facebook_error"] = str(e)
        
        # YouTube
        if self.youtube:
            try:
                results["youtube"] = self.youtube.upload_short(
                    video_path=video_path,
                    title=title,
                    description=description,
                    tags=tags,
                )
            except PublisherError as e:
                results["youtube_error"] = str(e)
        
        # TikTok
        if self.tiktok:
            try:
                results["tiktok"] = self.tiktok.upload_short(
                    video_path=video_path,
                    title=title,
                )
            except PublisherError as e:
                results["tiktok_error"] = str(e)
        
        return results


# =============================================================================
# TESTE
# =============================================================================

def main() -> int:
    parser = argparse.ArgumentParser(description="Testa publishers")
    parser.add_argument("--facebook", action="store_true", help="Testar Facebook")
    parser.add_argument("--youtube", action="store_true", help="Testar YouTube")
    parser.add_argument("--tiktok", action="store_true", help="Testar TikTok")
    parser.add_argument("--video", type=Path, help="Caminho do vídeo para teste")
    
    args = parser.parse_args()
    
    if not any([args.facebook, args.youtube, args.tiktok]):
        print("Especifique ao menos uma plataforma: --facebook, --youtube, --tiktok")
        return 1
    
    print("🧪 Testando publishers...\n")
    
    # Teste básico de configuração
    if args.facebook:
        token = input("Facebook access token: ").strip()
        if token:
            print("✓ Facebook: token configurado")
        else:
            print("✗ Facebook: token não fornecido")
    
    if args.youtube:
        creds_path = input("YouTube credentials path [credentials.json]: ").strip() or "credentials.json"
        if Path(creds_path).exists():
            print(f"✓ YouTube: credentials encontradas em {creds_path}")
        else:
            print(f"✗ YouTube: credentials não encontradas em {creds_path}")
    
    if args.tiktok:
        token = input("TikTok access token: ").strip()
        open_id = input("TikTok open ID: ").strip()
        if token and open_id:
            print("✓ TikTok: token e open_id configurados")
        else:
            print("✗ TikTok: token ou open_id não fornecidos")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
