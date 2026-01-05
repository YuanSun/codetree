"""
Speech recognition and processing for Chinese language learning.
Captures audio and converts it to text using OpenAI Whisper.
"""

import os
import io
import whisper
import numpy as np
from typing import Optional, Dict, Any
from dotenv import load_dotenv
import speech_recognition as sr

load_dotenv()


class SpeechProcessor:
    """Handles speech recognition and audio processing for Chinese learning."""

    def __init__(self, model_size: str = None):
        """
        Initialize the speech processor.

        Args:
            model_size: Whisper model size (tiny, base, small, medium, large)
        """
        self.model_size = model_size or os.getenv("WHISPER_MODEL", "base")
        self.sample_rate = int(os.getenv("SAMPLE_RATE", "16000"))
        self.language = os.getenv("LANGUAGE", "zh-CN")

        print(f"Loading Whisper model '{self.model_size}'...")
        self.model = whisper.load_model(self.model_size)
        print("Whisper model loaded successfully!")

        self.recognizer = sr.Recognizer()

    def record_audio(self, duration: int = 5) -> Optional[np.ndarray]:
        """
        Record audio from the microphone.

        Args:
            duration: Maximum recording duration in seconds

        Returns:
            Audio data as numpy array, or None if recording failed
        """
        try:
            with sr.Microphone(sample_rate=self.sample_rate) as source:
                print("Adjusting for ambient noise... Please wait.")
                self.recognizer.adjust_for_ambient_noise(source, duration=1)
                print(f"Listening... Speak now! (max {duration} seconds)")

                audio = self.recognizer.listen(source, timeout=duration, phrase_time_limit=duration)

                # Convert to numpy array
                audio_data = np.frombuffer(audio.get_raw_data(), dtype=np.int16)
                audio_data = audio_data.astype(np.float32) / 32768.0  # Normalize to [-1, 1]

                return audio_data
        except sr.WaitTimeoutError:
            print("No speech detected. Please try again.")
            return None
        except Exception as e:
            print(f"Error recording audio: {e}")
            return None

    def transcribe_audio(self, audio_data: np.ndarray) -> Dict[str, Any]:
        """
        Transcribe audio to Chinese text using Whisper.

        Args:
            audio_data: Audio data as numpy array

        Returns:
            Dictionary with transcription results including text, language, and confidence
        """
        try:
            # Whisper expects float32 audio
            result = self.model.transcribe(
                audio_data,
                language="zh",
                task="transcribe",
                fp16=False
            )

            return {
                "text": result["text"].strip(),
                "language": result.get("language", "zh"),
                "segments": result.get("segments", []),
                "success": True
            }
        except Exception as e:
            print(f"Error transcribing audio: {e}")
            return {
                "text": "",
                "language": "",
                "segments": [],
                "success": False,
                "error": str(e)
            }

    def process_audio_file(self, file_path: str) -> Dict[str, Any]:
        """
        Process an audio file and transcribe it.

        Args:
            file_path: Path to the audio file

        Returns:
            Dictionary with transcription results
        """
        try:
            result = self.model.transcribe(file_path, language="zh", task="transcribe")
            return {
                "text": result["text"].strip(),
                "language": result.get("language", "zh"),
                "segments": result.get("segments", []),
                "success": True
            }
        except Exception as e:
            print(f"Error processing audio file: {e}")
            return {
                "text": "",
                "language": "",
                "segments": [],
                "success": False,
                "error": str(e)
            }

    def record_and_transcribe(self, duration: int = 5) -> Dict[str, Any]:
        """
        Record audio and transcribe it in one step.

        Args:
            duration: Maximum recording duration in seconds

        Returns:
            Dictionary with transcription results
        """
        audio_data = self.record_audio(duration)
        if audio_data is None:
            return {
                "text": "",
                "language": "",
                "segments": [],
                "success": False,
                "error": "Failed to record audio"
            }

        return self.transcribe_audio(audio_data)


if __name__ == "__main__":
    # Test the speech processor
    processor = SpeechProcessor()

    print("\n=== Testing Speech Recognition ===")
    print("Please say something in Chinese...")

    result = processor.record_and_transcribe(duration=5)

    if result["success"]:
        print(f"\nTranscription: {result['text']}")
        print(f"Language: {result['language']}")
    else:
        print(f"\nTranscription failed: {result.get('error', 'Unknown error')}")
