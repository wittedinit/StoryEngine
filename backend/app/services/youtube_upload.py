"""YouTube Data API v3 — OAuth2, resumable upload, playlist management."""
from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
]
REDIRECT_URI = "http://localhost:8100/api/v1/youtube/oauth/callback"


def get_oauth_flow(client_id: str, client_secret: str):
    """Build a google_auth_oauthlib Flow for the YouTube upload scope."""
    from google_auth_oauthlib.flow import Flow

    client_config = {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [REDIRECT_URI],
        }
    }
    flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=REDIRECT_URI)
    return flow


def get_credentials(db):
    """Build google.oauth2.credentials.Credentials from stored settings."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from app.services.settings import get_setting_sync, save_setting_sync

    refresh_token = get_setting_sync(db, "youtube_refresh_token")
    client_id = get_setting_sync(db, "youtube_client_id")
    client_secret = get_setting_sync(db, "youtube_client_secret")

    if not refresh_token:
        raise RuntimeError("YouTube not connected. Authorise via Settings → YouTube.")

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=SCOPES,
    )
    # Refresh to get a valid access token
    creds.refresh(Request())
    return creds


def get_youtube_service(db):
    """Build an authenticated YouTube API service client."""
    from googleapiclient.discovery import build
    creds = get_credentials(db)
    return build("youtube", "v3", credentials=creds)


def upload_clip(youtube, clip_path: Path, title: str, description: str, privacy: str = "unlisted") -> str:
    """
    Upload a video file to YouTube using resumable upload.
    Returns the YouTube video ID.
    """
    from googleapiclient.http import MediaFileUpload

    body = {
        "snippet": {
            "title": title[:100],
            "description": description[:5000],
            "tags": ["StoryEngine"],
            "categoryId": "22",  # People & Blogs
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(
        str(clip_path),
        mimetype="video/*",
        resumable=True,
        chunksize=5 * 1024 * 1024,  # 5 MB chunks
    )

    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            logger.info("YouTube upload progress: %d%%", int(status.progress() * 100))

    video_id = response["id"]
    logger.info("YouTube upload complete: https://youtu.be/%s", video_id)
    return video_id


def create_or_get_playlist(youtube, title: str, description: str = "", privacy: str = "unlisted") -> str:
    """
    Find an existing YouTube playlist by title, or create one.
    Returns the playlist ID.
    """
    # Search existing playlists
    request = youtube.playlists().list(part="snippet", mine=True, maxResults=50)
    response = request.execute()
    for item in response.get("items", []):
        if item["snippet"]["title"].lower() == title.lower():
            return item["id"]

    # Create new playlist
    body = {
        "snippet": {"title": title[:150], "description": description},
        "status": {"privacyStatus": privacy},
    }
    response = youtube.playlists().insert(part="snippet,status", body=body).execute()
    playlist_id = response["id"]
    logger.info("Created YouTube playlist: %s (%s)", title, playlist_id)
    return playlist_id


def add_to_playlist(youtube, video_id: str, playlist_id: str) -> None:
    """Add a YouTube video to a playlist."""
    body = {
        "snippet": {
            "playlistId": playlist_id,
            "resourceId": {"kind": "youtube#video", "videoId": video_id},
        }
    }
    youtube.playlistItems().insert(part="snippet", body=body).execute()
    logger.info("Added video %s to playlist %s", video_id, playlist_id)


def get_channel_info(youtube) -> dict:
    """Get the authenticated channel's display name and ID."""
    response = youtube.channels().list(part="snippet", mine=True).execute()
    items = response.get("items", [])
    if not items:
        return {"name": "Unknown", "id": ""}
    snippet = items[0]["snippet"]
    return {"name": snippet.get("title", ""), "id": items[0]["id"]}
