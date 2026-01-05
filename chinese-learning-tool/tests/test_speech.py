"""Tests for speech processor."""

import pytest
import numpy as np
from unittest.mock import Mock, patch, MagicMock
from speech_processor import SpeechProcessor


@pytest.fixture
def processor():
    """Create a speech processor instance."""
    with patch("speech_processor.whisper.load_model") as mock_load:
        mock_model = Mock()
        mock_load.return_value = mock_model
        return SpeechProcessor()


def test_processor_initialization(processor):
    """Test processor initialization."""
    assert processor.model is not None
    assert processor.model_size == "base"
    assert processor.sample_rate == 16000


def test_transcribe_audio_success(processor):
    """Test successful audio transcription."""
    # Mock audio data
    audio_data = np.random.rand(16000).astype(np.float32)

    # Mock transcription result
    processor.model.transcribe.return_value = {
        "text": "你好",
        "language": "zh",
        "segments": []
    }

    result = processor.transcribe_audio(audio_data)

    assert result["success"] is True
    assert result["text"] == "你好"
    assert result["language"] == "zh"


def test_transcribe_audio_failure(processor):
    """Test failed audio transcription."""
    audio_data = np.random.rand(16000).astype(np.float32)

    # Mock transcription failure
    processor.model.transcribe.side_effect = Exception("Test error")

    result = processor.transcribe_audio(audio_data)

    assert result["success"] is False
    assert "error" in result
    assert result["text"] == ""


def test_process_audio_file_success(processor):
    """Test successful audio file processing."""
    # Mock transcription result
    processor.model.transcribe.return_value = {
        "text": "你好世界",
        "language": "zh",
        "segments": []
    }

    result = processor.process_audio_file("test.wav")

    assert result["success"] is True
    assert result["text"] == "你好世界"


def test_process_audio_file_failure(processor):
    """Test failed audio file processing."""
    # Mock transcription failure
    processor.model.transcribe.side_effect = Exception("File not found")

    result = processor.process_audio_file("nonexistent.wav")

    assert result["success"] is False
    assert "error" in result


@patch("speech_recognition.Microphone")
def test_record_audio_success(mock_mic, processor):
    """Test successful audio recording."""
    # Mock microphone
    mock_source = MagicMock()
    mock_mic.return_value.__enter__.return_value = mock_source

    # Mock audio data
    mock_audio = Mock()
    mock_audio.get_raw_data.return_value = np.random.randint(
        -32768, 32767, 16000, dtype=np.int16
    ).tobytes()

    processor.recognizer.listen.return_value = mock_audio

    result = processor.record_audio(duration=5)

    assert result is not None
    assert isinstance(result, np.ndarray)
    assert result.dtype == np.float32


@patch("speech_recognition.Microphone")
def test_record_audio_timeout(mock_mic, processor):
    """Test audio recording timeout."""
    import speech_recognition as sr

    # Mock microphone
    mock_source = MagicMock()
    mock_mic.return_value.__enter__.return_value = mock_source

    # Mock timeout
    processor.recognizer.listen.side_effect = sr.WaitTimeoutError()

    result = processor.record_audio(duration=5)

    assert result is None


def test_record_and_transcribe_integration(processor):
    """Test integration of recording and transcription."""
    # Mock successful recording
    audio_data = np.random.rand(16000).astype(np.float32)

    with patch.object(processor, "record_audio", return_value=audio_data):
        with patch.object(processor, "transcribe_audio") as mock_transcribe:
            mock_transcribe.return_value = {
                "text": "你好",
                "success": True,
                "language": "zh",
                "segments": []
            }

            result = processor.record_and_transcribe(duration=5)

            assert result["success"] is True
            assert result["text"] == "你好"


def test_record_and_transcribe_recording_failure(processor):
    """Test record_and_transcribe with recording failure."""
    with patch.object(processor, "record_audio", return_value=None):
        result = processor.record_and_transcribe(duration=5)

        assert result["success"] is False
        assert "error" in result
