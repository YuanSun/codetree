# Quick Start Guide

Get your Chinese Learning AI Tool up and running in minutes!

## Prerequisites

- Python 3.10 or higher
- Microphone (for pronunciation practice)
- API key for either Anthropic Claude or OpenAI GPT

## Installation

### 1. Clone or navigate to the project

```bash
cd chinese-learning-tool
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Install system dependencies (for audio)

**On macOS:**
```bash
brew install portaudio ffmpeg
```

**On Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y portaudio19-dev python3-pyaudio ffmpeg
```

**On Windows:**
```bash
# PyAudio: Download wheel from https://www.lfd.uci.edu/~gohlke/pythonlibs/#pyaudio
pip install PyAudio-0.2.11-cp310-cp310-win_amd64.whl
# ffmpeg: Download from https://ffmpeg.org/download.html
```

### 4. Configure API keys

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and add your API key:

**For Anthropic Claude (recommended):**
```bash
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_api_key_here
AI_MODEL=claude-3-5-sonnet-20241022
```

**For OpenAI GPT:**
```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your_api_key_here
AI_MODEL=gpt-4
```

## Getting API Keys

### Anthropic Claude
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new key and copy it

### OpenAI GPT
1. Go to https://platform.openai.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new key and copy it

## Usage

### Web Interface (Recommended for beginners)

Start the Streamlit app:
```bash
streamlit run app.py
```

Your browser will open automatically. The interface provides:
- **Learn & Explain**: Get explanations of Chinese text
- **Pronunciation Practice**: Upload audio and get feedback
- **Ask Questions**: Chat with AI tutor
- **Practice Exercises**: Generate custom exercises

### Command Line Interface

For quick pronunciation practice:
```bash
python cli_tutor.py --practice "你好"
```

For text explanations:
```bash
python cli_tutor.py --explain "我爱学中文" --context "Lesson 2"
```

To ask questions:
```bash
python cli_tutor.py --ask "How do Chinese tones work?"
```

Interactive mode:
```bash
python cli_tutor.py --interactive
```

## First Steps

### 1. Test text explanation
```bash
python cli_tutor.py --explain "你好，我叫小明。"
```

### 2. Practice pronunciation
```bash
python cli_tutor.py --practice "你好"
# Speak when prompted: "ni hao"
# Get instant feedback!
```

### 3. Launch web interface
```bash
streamlit run app.py
```

## Customization

Edit `.env` to customize:

- **Difficulty level**: `DIFFICULTY_LEVEL=beginner` (beginner/intermediate/advanced)
- **Feedback detail**: `FEEDBACK_DETAIL=detailed` (simple/detailed/verbose)
- **Whisper model**: `WHISPER_MODEL=base` (tiny/base/small/medium/large)
  - Larger models are more accurate but slower
  - For kids: `base` is recommended
  - For better accuracy: `medium` or `large`

## Troubleshooting

### "No module named 'whisper'"
```bash
pip install openai-whisper
```

### "No module named 'anthropic'"
```bash
pip install anthropic
```

### Microphone not working
- Check system permissions for microphone access
- On macOS: System Preferences → Security & Privacy → Microphone
- On Linux: Check ALSA/PulseAudio configuration

### Audio playback issues
Make sure ffmpeg is installed:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows: Download from https://ffmpeg.org/
```

### PyAudio installation fails
**macOS:**
```bash
brew install portaudio
pip install pyaudio
```

**Ubuntu:**
```bash
sudo apt-get install portaudio19-dev
pip install pyaudio
```

**Windows:**
Download pre-built wheel from https://www.lfd.uci.edu/~gohlke/pythonlibs/#pyaudio

## Tips for Best Results

1. **Speak clearly** when practicing pronunciation
2. **Use a quiet environment** for better recognition
3. **Start with simple phrases** before advancing
4. **Practice regularly** - consistency is key!
5. **Review AI feedback** carefully to improve

## Example Workflow

1. **Learn new vocabulary**:
   ```bash
   streamlit run app.py
   # Use "Learn & Explain" mode
   # Enter: 苹果
   # Get detailed explanation
   ```

2. **Practice pronunciation**:
   ```bash
   python cli_tutor.py --practice "苹果"
   # Listen to correct pronunciation
   # Record yourself saying it
   # Get AI feedback
   ```

3. **Ask questions**:
   ```bash
   python cli_tutor.py --ask "Why does 苹果 have two characters?"
   ```

4. **Generate exercises**:
   ```bash
   # Use web interface "Practice Exercises" mode
   # Enter lesson topic
   # Get custom exercises
   ```

## Next Steps

- Create a `.txt` file with vocabulary from your textbook
- Practice 10-15 minutes daily
- Use the "Ask Questions" mode when confused
- Track progress by recording pronunciation scores

Happy learning! 加油！🇨🇳
