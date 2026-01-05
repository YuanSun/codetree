# Chinese Learning AI Tool

An AI-powered interactive tool to help English-speaking children learn Chinese through textbook-based learning, pronunciation correction, and intelligent explanations.

## Features

- **Speech Recognition**: Captures and analyzes Chinese pronunciation in real-time
- **Pronunciation Correction**: Provides detailed feedback on tone, pinyin, and accuracy
- **AI Tutor**: Explains textbook content in English with cultural context
- **Interactive Interface**: Easy-to-use web interface built with Streamlit
- **Progress Tracking**: Monitors learning progress and identifies areas for improvement

## Architecture

The tool consists of three main components:

1. **Speech Processor** (`speech_processor.py`)
   - Captures audio from microphone
   - Converts speech to text using OpenAI Whisper
   - Analyzes pronunciation accuracy

2. **AI Tutor** (`ai_tutor.py`)
   - Uses Claude AI (Anthropic) or GPT-4 for intelligent tutoring
   - Explains Chinese characters, grammar, and cultural context
   - Provides personalized learning suggestions

3. **Web Interface** (`app.py`)
   - Interactive Streamlit application
   - Text-to-speech for pronunciation examples
   - Visual feedback on pronunciation accuracy

## Technology Stack

- **Python 3.10+**: Core language
- **OpenAI Whisper**: Speech-to-text (Chinese)
- **Anthropic Claude/OpenAI GPT-4**: AI tutoring
- **Streamlit**: Web interface
- **gTTS/pyttsx3**: Text-to-speech
- **pypinyin**: Chinese pinyin conversion
- **SpeechRecognition**: Audio capture

## Setup

See [QUICKSTART.md](QUICKSTART.md) for detailed installation and usage instructions.

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
# AI Provider (choose one)
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key

# Model selection
AI_MODEL=claude-3-5-sonnet-20241022  # or gpt-4
WHISPER_MODEL=base  # tiny, base, small, medium, large

# Audio settings
SAMPLE_RATE=16000
LANGUAGE=zh-CN
```

## Usage

```bash
# Start the interactive learning tool
python app.py

# Or use command-line mode
python cli_tutor.py --lesson "Lesson 1: Greetings"
```

## Project Structure

```
chinese-learning-tool/
├── README.md
├── QUICKSTART.md
├── .env.example
├── requirements.txt
├── app.py                    # Streamlit web interface
├── cli_tutor.py             # Command-line interface
├── speech_processor.py      # Speech recognition & analysis
├── ai_tutor.py              # AI tutoring engine
├── pronunciation_checker.py # Pronunciation evaluation
├── textbook_manager.py      # Textbook content management
└── tests/
    ├── test_speech.py
    ├── test_tutor.py
    └── test_pronunciation.py
```

## License

MIT License
