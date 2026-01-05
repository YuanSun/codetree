"""
Main Streamlit web application for Chinese Learning AI Tool.
Provides an interactive interface for pronunciation practice and learning.
"""

import os
import streamlit as st
from gtts import gTTS
from pypinyin import pinyin, Style
import tempfile
from pathlib import Path

# Import our modules
from speech_processor import SpeechProcessor
from pronunciation_checker import PronunciationChecker
from ai_tutor import AITutor


# Page configuration
st.set_page_config(
    page_title="Chinese Learning AI Tool",
    page_icon="🇨🇳",
    layout="wide",
    initial_sidebar_state="expanded"
)


def init_session_state():
    """Initialize session state variables."""
    if "tutor" not in st.session_state:
        st.session_state.tutor = AITutor()
    if "checker" not in st.session_state:
        st.session_state.checker = PronunciationChecker()
    if "processor" not in st.session_state:
        with st.spinner("Loading speech recognition model..."):
            st.session_state.processor = SpeechProcessor()
    if "lesson_text" not in st.session_state:
        st.session_state.lesson_text = "你好"
    if "last_result" not in st.session_state:
        st.session_state.last_result = None


def generate_audio(text: str, lang: str = "zh-CN") -> str:
    """
    Generate audio file from text using gTTS.

    Args:
        text: Text to convert to speech
        lang: Language code

    Returns:
        Path to temporary audio file
    """
    try:
        tts = gTTS(text=text, lang=lang, slow=False)
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        tts.save(temp_file.name)
        return temp_file.name
    except Exception as e:
        st.error(f"Error generating audio: {e}")
        return None


def display_pinyin(text: str):
    """Display Chinese text with pinyin above it."""
    pinyin_list = pinyin(text, style=Style.TONE)
    pinyin_text = " ".join([p[0] for p in pinyin_list])

    col1, col2 = st.columns([1, 3])
    with col1:
        st.markdown("**Pinyin:**")
    with col2:
        st.markdown(f"`{pinyin_text}`")


def main():
    """Main application."""
    init_session_state()

    # Sidebar
    with st.sidebar:
        st.title("🇨🇳 Chinese Learning")
        st.markdown("---")

        mode = st.radio(
            "Choose Mode:",
            ["📚 Learn & Explain", "🎤 Pronunciation Practice", "❓ Ask Questions", "📝 Practice Exercises"]
        )

        st.markdown("---")
        st.markdown("### Settings")
        difficulty = st.selectbox(
            "Difficulty Level",
            ["beginner", "intermediate", "advanced"],
            index=0
        )

        st.markdown("---")
        st.markdown("### About")
        st.info("An AI-powered tool to help children learn Chinese through interactive lessons, pronunciation practice, and personalized tutoring.")

    # Main content
    st.title("Chinese Learning AI Tool")

    if mode == "📚 Learn & Explain":
        st.header("Learn Chinese Text")
        st.markdown("Enter Chinese text from your textbook and get detailed explanations in English.")

        col1, col2 = st.columns([2, 1])

        with col1:
            chinese_input = st.text_area(
                "Enter Chinese text:",
                value=st.session_state.lesson_text,
                height=100,
                placeholder="你好，我叫小明。"
            )

            context = st.text_input(
                "Context (optional):",
                placeholder="e.g., Lesson 3: Introductions"
            )

        with col2:
            if chinese_input:
                st.markdown("#### Preview")
                st.markdown(f"### {chinese_input}")
                display_pinyin(chinese_input)

                # Generate and play audio
                if st.button("🔊 Play Audio", key="learn_audio"):
                    audio_file = generate_audio(chinese_input)
                    if audio_file:
                        st.audio(audio_file)
                        Path(audio_file).unlink()

        if st.button("📖 Get Explanation", type="primary", key="explain_btn"):
            if chinese_input:
                with st.spinner("AI Tutor is preparing explanation..."):
                    explanation = st.session_state.tutor.explain_text(chinese_input, context)

                st.markdown("### Explanation")
                st.markdown(explanation)
                st.session_state.lesson_text = chinese_input
            else:
                st.warning("Please enter Chinese text first.")

    elif mode == "🎤 Pronunciation Practice":
        st.header("Pronunciation Practice")
        st.markdown("Practice pronouncing Chinese text and get instant feedback!")

        col1, col2 = st.columns([2, 1])

        with col1:
            expected_text = st.text_input(
                "Text to practice:",
                value=st.session_state.lesson_text,
                placeholder="你好"
            )

        with col2:
            if expected_text:
                st.markdown("#### Target")
                st.markdown(f"### {expected_text}")
                display_pinyin(expected_text)

                if st.button("🔊 Hear Pronunciation", key="practice_audio"):
                    audio_file = generate_audio(expected_text)
                    if audio_file:
                        st.audio(audio_file)
                        Path(audio_file).unlink()

        st.markdown("---")

        # Recording options
        st.markdown("### Record Your Pronunciation")

        recording_method = st.radio(
            "Choose method:",
            ["Upload Audio File", "Record from Microphone (CLI)"],
            horizontal=True
        )

        if recording_method == "Upload Audio File":
            uploaded_file = st.file_uploader(
                "Upload your audio recording:",
                type=["wav", "mp3", "m4a", "ogg"]
            )

            if uploaded_file and st.button("🎯 Check Pronunciation", type="primary"):
                # Save uploaded file temporarily
                with tempfile.NamedTemporaryFile(delete=False, suffix=Path(uploaded_file.name).suffix) as tmp_file:
                    tmp_file.write(uploaded_file.read())
                    tmp_path = tmp_file.name

                with st.spinner("Analyzing your pronunciation..."):
                    # Transcribe audio
                    result = st.session_state.processor.process_audio_file(tmp_path)

                    if result["success"]:
                        actual_text = result["text"]

                        # Evaluate pronunciation
                        evaluation = st.session_state.checker.evaluate_pronunciation(
                            expected_text,
                            actual_text
                        )

                        # Get AI feedback
                        ai_feedback = st.session_state.tutor.check_pronunciation_with_ai(
                            expected_text,
                            actual_text,
                            evaluation
                        )

                        # Display results
                        st.success("Analysis complete!")

                        col1, col2, col3 = st.columns(3)
                        with col1:
                            st.metric("Overall Score", f"{evaluation['overall_score']}%")
                        with col2:
                            st.metric("Grade", evaluation['grade'])
                        with col3:
                            accuracy = evaluation['text_comparison']['accuracy']
                            st.metric("Accuracy", f"{accuracy}%")

                        st.markdown("### What You Said")
                        st.info(f"**Transcription:** {actual_text}")

                        st.markdown("### AI Tutor Feedback")
                        st.markdown(ai_feedback)

                    else:
                        st.error(f"Failed to process audio: {result.get('error', 'Unknown error')}")

                # Clean up
                Path(tmp_path).unlink()

        else:
            st.info("""
            **Microphone recording requires running in CLI mode:**

            1. Open terminal in the project directory
            2. Run: `python cli_tutor.py --practice "{expected_text}"`
            3. Speak when prompted
            4. Get instant feedback!
            """)

    elif mode == "❓ Ask Questions":
        st.header("Ask Your Chinese Tutor")
        st.markdown("Have questions about Chinese language or culture? Ask away!")

        question = st.text_area(
            "Your question:",
            placeholder="e.g., What's the difference between 的, 地, and 得?"
        )

        lesson_context = st.text_input(
            "Current lesson (optional):",
            placeholder="e.g., Lesson 5: Family members"
        )

        if st.button("💬 Ask Tutor", type="primary"):
            if question:
                with st.spinner("AI Tutor is thinking..."):
                    answer = st.session_state.tutor.answer_question(question, lesson_context)

                st.markdown("### Answer")
                st.markdown(answer)
            else:
                st.warning("Please enter a question first.")

    elif mode == "📝 Practice Exercises":
        st.header("Practice Exercises")
        st.markdown("Generate custom practice exercises based on your lessons!")

        lesson_content = st.text_area(
            "Enter lesson content or topic:",
            placeholder="e.g., Greetings and introductions: 你好，我叫...",
            height=150
        )

        num_exercises = st.slider("Number of exercises:", 3, 10, 5)

        if st.button("✍️ Generate Exercises", type="primary"):
            if lesson_content:
                with st.spinner("Creating practice exercises..."):
                    exercises = st.session_state.tutor.generate_practice_exercises(
                        lesson_content,
                        num_exercises
                    )

                st.markdown("### Your Practice Exercises")
                st.markdown(exercises)
            else:
                st.warning("Please enter lesson content first.")


if __name__ == "__main__":
    main()
