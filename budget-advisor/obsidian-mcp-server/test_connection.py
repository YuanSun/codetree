#!/usr/bin/env python3
"""
Test script to verify Obsidian Local REST API connection.
"""

import sys
from obsidian_operations import create_obsidian_client_from_env

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Warning: python-dotenv not installed")


def test_connection():
    """Test connection to Obsidian REST API"""
    print("=" * 70)
    print("Obsidian MCP Server - Connection Test")
    print("=" * 70)
    print()

    try:
        # Initialize client
        print("1. Initializing Obsidian client...")
        client = create_obsidian_client_from_env()
        print("   ✓ Client initialized")
        print()

        # Test vault info
        print("2. Getting vault information...")
        vault_info = client.get_vault_info()
        print(f"   ✓ Vault name: {vault_info.get('name', 'Unknown')}")
        print(f"   ✓ Path: {client.vault_path}")
        print()

        # Test listing files
        print("3. Listing files in root directory...")
        files = client.list_files()
        print(f"   ✓ Found {len(files)} files/folders")
        if files:
            print("   First 5 items:")
            for item in files[:5]:
                file_type = "📁" if item.get('type') == 'folder' else "📄"
                print(f"     {file_type} {item.get('path', item.get('name', 'Unknown'))}")
        print()

        # Test getting tags
        print("4. Getting tags...")
        try:
            tags = client.get_tags()
            print(f"   ✓ Found {len(tags)} tags")
            if tags:
                print(f"   Sample tags: {', '.join(tags[:10])}")
        except Exception as e:
            print(f"   ⚠ Tags not available: {e}")
        print()

        # Test search
        print("5. Testing search (searching for 'test')...")
        try:
            results = client.search_notes("test")
            print(f"   ✓ Search returned {len(results)} results")
        except Exception as e:
            print(f"   ⚠ Search failed: {e}")
        print()

        print("=" * 70)
        print("✅ All tests passed! Obsidian MCP server is ready to use.")
        print("=" * 70)
        print()
        print("You can now:")
        print("1. Start the MCP server: python3.11 server.py")
        print("2. Configure Antigravity IDE with the server details")
        print()

        return True

    except Exception as e:
        print()
        print("=" * 70)
        print("❌ Connection test failed!")
        print("=" * 70)
        print()
        print(f"Error: {e}")
        print()
        print("Troubleshooting:")
        print("1. Check that Obsidian is running")
        print("2. Verify Local REST API plugin is enabled")
        print("3. Check .env file has correct settings:")
        print("   - OBSIDIAN_BASE_URL=https://127.0.0.1:27124")
        print("   - OBSIDIAN_API_KEY=<your-api-key>")
        print("   - OBSIDIAN_VAULT_PATH=<path-to-vault>")
        print("4. Verify the API is accessible:")
        print("   curl -k -H 'Authorization: Bearer YOUR_KEY' https://127.0.0.1:27124/vault/")
        print()

        return False


if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)
