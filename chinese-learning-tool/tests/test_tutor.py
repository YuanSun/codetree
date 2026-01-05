"""Tests for AI tutor."""

import pytest
import os
from unittest.mock import Mock, patch
from ai_tutor import AITutor


@pytest.fixture
def mock_anthropic_client():
    """Mock Anthropic client."""
    with patch.dict(os.environ, {"AI_PROVIDER": "anthropic", "ANTHROPIC_API_KEY": "test_key"}):
        with patch("ai_tutor.Anthropic") as mock_anthropic:
            mock_instance = Mock()
            mock_anthropic.return_value = mock_instance

            # Mock response
            mock_response = Mock()
            mock_response.content = [Mock(text="This is a test response")]
            mock_instance.messages.create.return_value = mock_response

            yield mock_instance


@pytest.fixture
def tutor_anthropic(mock_anthropic_client):
    """Create AI tutor instance with Anthropic."""
    return AITutor()


def test_tutor_initialization_anthropic():
    """Test tutor initialization with Anthropic."""
    with patch.dict(os.environ, {"AI_PROVIDER": "anthropic", "ANTHROPIC_API_KEY": "test_key"}):
        with patch("ai_tutor.Anthropic"):
            tutor = AITutor()
            assert tutor.provider == "anthropic"


def test_tutor_initialization_openai():
    """Test tutor initialization with OpenAI."""
    with patch.dict(os.environ, {"AI_PROVIDER": "openai", "OPENAI_API_KEY": "test_key"}):
        with patch("ai_tutor.OpenAI"):
            tutor = AITutor()
            assert tutor.provider == "openai"


def test_tutor_invalid_provider():
    """Test tutor initialization with invalid provider."""
    with patch.dict(os.environ, {"AI_PROVIDER": "invalid"}):
        with pytest.raises(ValueError, match="Unsupported AI provider"):
            AITutor()


def test_explain_text(tutor_anthropic, mock_anthropic_client):
    """Test text explanation."""
    result = tutor_anthropic.explain_text("你好", "Lesson 1")

    assert result == "This is a test response"
    mock_anthropic_client.messages.create.assert_called_once()


def test_check_pronunciation_with_ai(tutor_anthropic, mock_anthropic_client):
    """Test pronunciation checking with AI."""
    pronunciation_data = {"overall_score": 85}
    result = tutor_anthropic.check_pronunciation_with_ai("你好", "你好", pronunciation_data)

    assert result == "This is a test response"
    mock_anthropic_client.messages.create.assert_called_once()


def test_answer_question(tutor_anthropic, mock_anthropic_client):
    """Test question answering."""
    result = tutor_anthropic.answer_question("What are tones?", "Lesson 2")

    assert result == "This is a test response"
    mock_anthropic_client.messages.create.assert_called_once()


def test_generate_practice_exercises(tutor_anthropic, mock_anthropic_client):
    """Test practice exercise generation."""
    result = tutor_anthropic.generate_practice_exercises("Greetings", 5)

    assert result == "This is a test response"
    mock_anthropic_client.messages.create.assert_called_once()


def test_get_cultural_note(tutor_anthropic, mock_anthropic_client):
    """Test cultural note retrieval."""
    result = tutor_anthropic.get_cultural_note("Spring Festival")

    assert result == "This is a test response"
    mock_anthropic_client.messages.create.assert_called_once()


@pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="Requires ANTHROPIC_API_KEY for integration test"
)
def test_real_api_call():
    """Integration test with real API (only runs if API key is set)."""
    tutor = AITutor()
    result = tutor.explain_text("你好")

    assert len(result) > 0
    assert "你" in result or "hello" in result.lower()
