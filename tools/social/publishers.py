"""
Publishers para Facebook Reels, YouTube Shorts e TikTok.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

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
    
    Docs: https://developers.facebook.com/docs/video-api/guides/reels-publishing/
    """
    
    def __init__(self, access_token: str, api_version: Optional[str] = None):
        import os
        self.access_token = access_token
        self.api_version = api_version or os.environ.get("META_GRAPH_VERSION", "").strip() or "v23.0"
        self.base_url = f"https://graph.facebook.com/{self.api_version}"
    
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
        
        url = f"{self.base_url}/{page_id}/video_reels"
        print("   📤 Publicando no Facebook Reels...")
        print(f"      Página: {page_id}")
        session = self._request("post", url, data={
            "access_token": page_token, "upload_phase": "start",
        })
        video_id = session.get("video_id")
        upload_url = session.get("upload_url", "")
        if not video_id or urlparse(upload_url).scheme != "https" or urlparse(upload_url).hostname != "rupload.facebook.com":
            raise PublisherError("Facebook did not return a valid Reels upload session")

        with open(video_path, "rb") as video_file:
            uploaded = self._request("post", upload_url, headers={
                "Authorization": f"OAuth {page_token}",
                "offset": "0",
                "file_size": str(video_path.stat().st_size),
                "Content-Type": "application/octet-stream",
            }, data=video_file, timeout=120)
        if uploaded.get("success") is not True:
            raise PublisherError("Facebook rejected the Reels video upload")

        finished = self._request("post", url, data={
            "access_token": page_token,
            "upload_phase": "finish",
            "video_id": video_id,
            "video_state": "PUBLISHED",
            "title": title,
            "description": description or title,
        })
        if finished.get("success") is not True:
            raise PublisherError("Facebook rejected the Reels publication")

        # Finish is asynchronous: only record a publication after Meta confirms it.
        for attempt in range(24):
            payload = self._request("get", f"{self.base_url}/{video_id}", params={
                "access_token": page_token, "fields": "status",
            })
            status = payload.get("status", {})
            phases = [status.get(name, {}).get("status") for name in (
                "uploading_phase", "processing_phase", "publishing_phase",
            )]
            if status.get("video_status") == "error" or "error" in phases:
                raise PublisherError(f"Facebook failed to process Reel {video_id}")
            if status.get("publishing_phase", {}).get("status") == "complete":
                print(f"      ✓ Reel publicado: {video_id}")
                return str(video_id)
            if attempt < 23:
                time.sleep(5)
        raise PublisherError(f"Facebook has not confirmed publication of Reel {video_id}; check its status before retrying")

    def _request(self, method: str, url: str, **kwargs) -> dict:
        kwargs.setdefault("timeout", 30)
        try:
            response = getattr(requests, method)(url, **kwargs)
            payload = response.json()
        except requests.RequestException as exc:
            # Request URLs and exception messages can contain the access token.
            raise PublisherError(f"Facebook request failed ({type(exc).__name__})") from None
        except ValueError:
            raise PublisherError("Facebook returned a non-JSON response") from None
        if not isinstance(payload, dict):
            raise PublisherError("Facebook returned an invalid response")
        if response.status_code >= 400 or payload.get("error"):
            error = payload.get("error") or {}
            raise PublisherError(f"Facebook API {response.status_code} (code {error.get('code', 'unknown')}, subcode {error.get('error_subcode', 'unknown')})")
        return payload
    
    def _get_page_access_token(self, page_id: str) -> str:
        """
        Obtém Page Access Token a partir do System User Token.
        
        Na nova experiência de Páginas, o System User Token precisa ser
        trocado por um Page Access Token via /me/accounts.
        """
        url = f"{self.base_url}/me/accounts"
        params = {"access_token": self.access_token}
        
        result = self._request("get", url, params=params)
        
        # Encontrar a página pelo ID
        for page in result.get("data", []):
            if str(page.get("id")) == str(page_id) and page.get("access_token"):
                return page["access_token"]
        
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
