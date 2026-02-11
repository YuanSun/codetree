"""
Obsidian Local REST API client operations.
Provides methods to interact with Obsidian vault via the Local REST API plugin.
"""

import os
import requests
import urllib3
from typing import Optional, List, Dict, Any

# Disable SSL warnings for local HTTPS connections
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class ObsidianClient:
    """Client for interacting with Obsidian Local REST API"""

    def __init__(self, base_url: str, api_key: str, vault_path: str):
        """
        Initialize Obsidian client.

        Args:
            base_url: Base URL for the Obsidian REST API (e.g., https://127.0.0.1:27124)
            api_key: API key for authentication
            vault_path: Path to the Obsidian vault
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.vault_path = vault_path
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Make HTTP request to Obsidian REST API.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE, PATCH)
            endpoint: API endpoint path
            data: Request body data
            params: Query parameters

        Returns:
            Response data as dictionary

        Raises:
            Exception: If request fails
        """
        url = f"{self.base_url}{endpoint}"

        try:
            response = requests.request(
                method=method,
                url=url,
                headers=self.headers,
                json=data,
                params=params,
                verify=False,  # Disable SSL verification for localhost
                timeout=30
            )

            response.raise_for_status()

            # Some endpoints return empty responses
            if response.status_code == 204 or not response.content:
                return {'success': True}

            return response.json()

        except requests.exceptions.RequestException as e:
            raise Exception(f"Obsidian API request failed: {str(e)}")

    def get_vault_info(self) -> Dict[str, Any]:
        """Get vault information"""
        return self._make_request('GET', '/vault/')

    def list_files(self, path: str = "") -> List[Dict[str, Any]]:
        """
        List files in vault or specific directory.

        Args:
            path: Directory path (empty for root)

        Returns:
            List of file/folder information
        """
        endpoint = f'/vault/{path}' if path else '/vault/'
        response = self._make_request('GET', endpoint)
        return response.get('files', [])

    def get_file_content(self, file_path: str) -> str:
        """
        Get content of a file.

        Args:
            file_path: Path to the file in the vault

        Returns:
            File content as string
        """
        response = self._make_request('GET', f'/vault/{file_path}')
        return response.get('content', '')

    def create_note(self, file_path: str, content: str) -> Dict[str, Any]:
        """
        Create a new note.

        Args:
            file_path: Path where to create the note (e.g., "folder/note.md")
            content: Content of the note

        Returns:
            Response data
        """
        return self._make_request(
            'POST',
            f'/vault/{file_path}',
            data={'content': content}
        )

    def update_note(self, file_path: str, content: str) -> Dict[str, Any]:
        """
        Update existing note content.

        Args:
            file_path: Path to the note
            content: New content

        Returns:
            Response data
        """
        return self._make_request(
            'PUT',
            f'/vault/{file_path}',
            data={'content': content}
        )

    def append_to_note(self, file_path: str, content: str) -> Dict[str, Any]:
        """
        Append content to existing note.

        Args:
            file_path: Path to the note
            content: Content to append

        Returns:
            Response data
        """
        return self._make_request(
            'PATCH',
            f'/vault/{file_path}',
            data={'content': content}
        )

    def delete_note(self, file_path: str) -> Dict[str, Any]:
        """
        Delete a note.

        Args:
            file_path: Path to the note

        Returns:
            Response data
        """
        return self._make_request('DELETE', f'/vault/{file_path}')

    def search_notes(self, query: str) -> List[Dict[str, Any]]:
        """
        Search notes with simple text search.

        Args:
            query: Search query

        Returns:
            List of matching files
        """
        response = self._make_request('GET', f'/search/simple/', params={'query': query})
        return response.get('results', [])

    def get_active_file(self) -> Dict[str, Any]:
        """
        Get currently active file in Obsidian.

        Returns:
            Active file information
        """
        return self._make_request('GET', '/active/')

    def open_file(self, file_path: str) -> Dict[str, Any]:
        """
        Open a file in Obsidian.

        Args:
            file_path: Path to the file

        Returns:
            Response data
        """
        return self._make_request('PUT', '/open/{file_path}')

    def get_tags(self) -> List[str]:
        """
        Get all tags used in the vault.

        Returns:
            List of tags
        """
        response = self._make_request('GET', '/tags/')
        return response.get('tags', [])


def create_obsidian_client_from_env() -> ObsidianClient:
    """
    Create ObsidianClient instance from environment variables.

    Required environment variables:
        OBSIDIAN_BASE_URL: Base URL for REST API
        OBSIDIAN_API_KEY: API key for authentication
        OBSIDIAN_VAULT_PATH: Path to vault

    Returns:
        Configured ObsidianClient instance
    """
    base_url = os.getenv('OBSIDIAN_BASE_URL')
    api_key = os.getenv('OBSIDIAN_API_KEY')
    vault_path = os.getenv('OBSIDIAN_VAULT_PATH')

    if not all([base_url, api_key, vault_path]):
        raise ValueError(
            "Missing required environment variables: "
            "OBSIDIAN_BASE_URL, OBSIDIAN_API_KEY, OBSIDIAN_VAULT_PATH"
        )

    return ObsidianClient(base_url, api_key, vault_path)
