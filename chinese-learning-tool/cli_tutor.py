"""
Command-line interface for Chinese Learning AI Tool.
Provides quick access to pronunciation practice via terminal.
"""

import argparse
import sys
from speech_processor import SpeechProcessor
from pronunciation_checker import PronunciationChecker
from ai_tutor import AITutor
from pypinyin import pinyin, Style
from gtts import gTTS
import tempfile
import os


def play_audio(text: str):
    """Generate and play audio pronunciation."""
    try:
        tts = gTTS(text=text, lang="zh-CN", slow=False)
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        tts.save(temp_file.name)

        print(f"\nPlaying pronunciation...")
        # Try to play audio using system command
        if sys.platform == "darwin":  # macOS
            os.system(f"afplay {temp_file.name}")
        elif sys.platform == "linux":
            os.system(f"mpg123 {temp_file.name} 2>/dev/null || ffplay -nodisp -autoexit {temp_file.name} 2>/dev/null")
        elif sys.platform == "win32":
            os.system(f"start {temp_file.name}")

        os.unlink(temp_file.name)
    except Exception as e:
        print(f"Could not play audio: {e}")


def practice_mode(text: str):
    """Practice pronunciation with immediate feedback."""
    print("\n" + "="*60)
    print("🎤 PRONUNCIATION PRACTICE MODE")
    print("="*60)

    # Initialize components
    print("\nInitializing AI components...")
    processor = SpeechProcessor()
    checker = PronunciationChecker()
    tutor = AITutor()

    # Display target text
    pinyin_text = " ".join([p[0] for p in pinyin(text, style=Style.TONE)])
    print(f"\n📖 Practice text: {text}")
    print(f"📌 Pinyin: {pinyin_text}")

    # Play pronunciation
    play_audio(text)

    # Record and evaluate
    print("\n" + "-"*60)
    input("Press ENTER when ready to record...")

    result = processor.record_and_transcribe(duration=5)

    if result["success"]:
        actual_text = result["text"]
        print(f"\n✅ You said: {actual_text}")

        # Evaluate
        print("\nAnalyzing pronunciation...")
        evaluation = checker.evaluate_pronunciation(text, actual_text)

        # Display results
        print("\n" + "="*60)
        print("📊 PRONUNCIATION RESULTS")
        print("="*60)
        print(f"Overall Score: {evaluation['overall_score']}%")
        print(f"Grade: {evaluation['grade']}")
        print(f"Text Accuracy: {evaluation['text_comparison']['accuracy']}%")
        print(f"Tone Accuracy: {evaluation['pinyin_comparison']['pinyin_accuracy']}%")

        print("\n" + "-"*60)
        print("💬 AI TUTOR FEEDBACK")
        print("-"*60)

        ai_feedback = tutor.check_pronunciation_with_ai(text, actual_text, evaluation)
        print(ai_feedback)

    else:
        print(f"\n❌ Failed to process audio: {result.get('error', 'Unknown error')}")


def explain_mode(text: str, context: str = ""):
    """Get explanation for Chinese text."""
    print("\n" + "="*60)
    print("📚 TEXT EXPLANATION MODE")
    print("="*60)

    tutor = AITutor()

    pinyin_text = " ".join([p[0] for p in pinyin(text, style=Style.TONE)])
    print(f"\n📖 Text: {text}")
    print(f"📌 Pinyin: {pinyin_text}")

    if context:
        print(f"📝 Context: {context}")

    print("\nGetting explanation from AI Tutor...\n")

    explanation = tutor.explain_text(text, context)

    print("="*60)
    print("EXPLANATION")
    print("="*60)
    print(explanation)


def question_mode(question: str, context: str = ""):
    """Ask a question to the AI tutor."""
    print("\n" + "="*60)
    print("❓ QUESTION MODE")
    print("="*60)

    tutor = AITutor()

    print(f"\n❓ Your question: {question}")
    if context:
        print(f"📝 Context: {context}")

    print("\nAI Tutor is thinking...\n")

    answer = tutor.answer_question(question, context)

    print("="*60)
    print("ANSWER")
    print("="*60)
    print(answer)


def interactive_mode():
    """Interactive CLI mode."""
    print("\n" + "="*60)
    print("🇨🇳 CHINESE LEARNING AI TOOL - INTERACTIVE MODE")
    print("="*60)

    tutor = AITutor()

    print("\nCommands:")
    print("  practice <text>  - Practice pronunciation")
    print("  explain <text>   - Get explanation")
    print("  ask <question>   - Ask a question")
    print("  quit             - Exit")

    while True:
        try:
            user_input = input("\n> ").strip()

            if not user_input:
                continue

            if user_input.lower() in ["quit", "exit", "q"]:
                print("\nGoodbye! Keep practicing! 加油！")
                break

            parts = user_input.split(maxsplit=1)
            command = parts[0].lower()

            if len(parts) < 2:
                print("Please provide text or question after the command.")
                continue

            content = parts[1]

            if command == "practice":
                practice_mode(content)
            elif command == "explain":
                explain_mode(content)
            elif command == "ask":
                question_mode(content)
            else:
                print(f"Unknown command: {command}")

        except KeyboardInterrupt:
            print("\n\nGoodbye! Keep practicing! 加油！")
            break
        except Exception as e:
            print(f"\nError: {e}")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Chinese Learning AI Tool - Command Line Interface"
    )

    parser.add_argument(
        "--practice",
        type=str,
        help="Practice pronunciation of Chinese text"
    )

    parser.add_argument(
        "--explain",
        type=str,
        help="Get explanation for Chinese text"
    )

    parser.add_argument(
        "--ask",
        type=str,
        help="Ask a question to the AI tutor"
    )

    parser.add_argument(
        "--context",
        type=str,
        default="",
        help="Additional context for the query"
    )

    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Start interactive mode"
    )

    args = parser.parse_args()

    if args.practice:
        practice_mode(args.practice)
    elif args.explain:
        explain_mode(args.explain, args.context)
    elif args.ask:
        question_mode(args.ask, args.context)
    elif args.interactive:
        interactive_mode()
    else:
        # Default to interactive mode if no arguments
        interactive_mode()


if __name__ == "__main__":
    main()
