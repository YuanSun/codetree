"""
Pronunciation checking and evaluation for Chinese language learning.
Compares student pronunciation with expected text and provides feedback.
"""

import os
from typing import Dict, List, Any, Tuple
from pypinyin import pinyin, Style
from difflib import SequenceMatcher
from dotenv import load_dotenv

load_dotenv()


class PronunciationChecker:
    """Evaluates Chinese pronunciation accuracy and provides feedback."""

    def __init__(self):
        """Initialize the pronunciation checker."""
        self.feedback_detail = os.getenv("FEEDBACK_DETAIL", "detailed")

    def get_pinyin(self, text: str, with_tone: bool = True) -> List[List[str]]:
        """
        Convert Chinese text to pinyin.

        Args:
            text: Chinese text
            with_tone: Include tone marks

        Returns:
            List of pinyin for each character
        """
        style = Style.TONE if with_tone else Style.NORMAL
        return pinyin(text, style=style, heteronym=False)

    def compare_texts(self, expected: str, actual: str) -> Dict[str, Any]:
        """
        Compare expected text with actual transcription.

        Args:
            expected: Expected Chinese text
            actual: Actual transcribed text

        Returns:
            Dictionary with comparison results and accuracy metrics
        """
        # Remove spaces and normalize
        expected_clean = expected.replace(" ", "").strip()
        actual_clean = actual.replace(" ", "").strip()

        # Calculate similarity
        similarity = SequenceMatcher(None, expected_clean, actual_clean).ratio()
        accuracy = round(similarity * 100, 2)

        # Character-level comparison
        expected_chars = list(expected_clean)
        actual_chars = list(actual_clean)

        correct_chars = 0
        char_feedback = []

        for i, expected_char in enumerate(expected_chars):
            if i < len(actual_chars):
                if expected_char == actual_chars[i]:
                    correct_chars += 1
                    char_feedback.append({
                        "position": i,
                        "expected": expected_char,
                        "actual": actual_chars[i],
                        "correct": True
                    })
                else:
                    char_feedback.append({
                        "position": i,
                        "expected": expected_char,
                        "actual": actual_chars[i],
                        "correct": False
                    })
            else:
                char_feedback.append({
                    "position": i,
                    "expected": expected_char,
                    "actual": "(missing)",
                    "correct": False
                })

        # Handle extra characters
        for i in range(len(expected_chars), len(actual_chars)):
            char_feedback.append({
                "position": i,
                "expected": "(none)",
                "actual": actual_chars[i],
                "correct": False
            })

        return {
            "expected": expected_clean,
            "actual": actual_clean,
            "accuracy": accuracy,
            "correct_chars": correct_chars,
            "total_chars": len(expected_chars),
            "char_feedback": char_feedback
        }

    def compare_pinyin(self, expected_text: str, actual_text: str) -> Dict[str, Any]:
        """
        Compare pinyin pronunciation between expected and actual text.

        Args:
            expected_text: Expected Chinese text
            actual_text: Actual Chinese text

        Returns:
            Dictionary with pinyin comparison results
        """
        expected_pinyin = self.get_pinyin(expected_text, with_tone=True)
        actual_pinyin = self.get_pinyin(actual_text, with_tone=True)

        # Flatten pinyin lists
        expected_flat = [p[0] for p in expected_pinyin]
        actual_flat = [p[0] for p in actual_pinyin]

        # Compare pinyin
        pinyin_matches = 0
        pinyin_feedback = []

        for i, expected_py in enumerate(expected_flat):
            if i < len(actual_flat):
                match = expected_py == actual_flat[i]
                if match:
                    pinyin_matches += 1

                pinyin_feedback.append({
                    "position": i,
                    "expected": expected_py,
                    "actual": actual_flat[i],
                    "match": match
                })
            else:
                pinyin_feedback.append({
                    "position": i,
                    "expected": expected_py,
                    "actual": "(missing)",
                    "match": False
                })

        pinyin_accuracy = round((pinyin_matches / len(expected_flat) * 100), 2) if expected_flat else 0

        return {
            "expected_pinyin": expected_flat,
            "actual_pinyin": actual_flat,
            "pinyin_accuracy": pinyin_accuracy,
            "matches": pinyin_matches,
            "total": len(expected_flat),
            "feedback": pinyin_feedback
        }

    def evaluate_pronunciation(self, expected: str, actual: str) -> Dict[str, Any]:
        """
        Comprehensive pronunciation evaluation.

        Args:
            expected: Expected Chinese text
            actual: Actual transcribed text

        Returns:
            Complete evaluation with text and pinyin comparison
        """
        text_comparison = self.compare_texts(expected, actual)
        pinyin_comparison = self.compare_pinyin(expected, actual)

        # Overall score (weighted average)
        overall_score = round((text_comparison["accuracy"] * 0.7 + pinyin_comparison["pinyin_accuracy"] * 0.3), 2)

        # Generate feedback message
        feedback_message = self._generate_feedback(
            text_comparison,
            pinyin_comparison,
            overall_score
        )

        return {
            "overall_score": overall_score,
            "text_comparison": text_comparison,
            "pinyin_comparison": pinyin_comparison,
            "feedback_message": feedback_message,
            "grade": self._get_grade(overall_score)
        }

    def _generate_feedback(
        self,
        text_comp: Dict[str, Any],
        pinyin_comp: Dict[str, Any],
        score: float
    ) -> str:
        """Generate human-readable feedback message."""
        feedback = []

        if score >= 95:
            feedback.append("Excellent! Your pronunciation is nearly perfect!")
        elif score >= 85:
            feedback.append("Great job! Your pronunciation is very good.")
        elif score >= 70:
            feedback.append("Good effort! You're making progress.")
        elif score >= 50:
            feedback.append("Keep practicing! Here are some areas to improve:")
        else:
            feedback.append("Don't give up! Let's work on your pronunciation:")

        # Character accuracy
        char_accuracy = text_comp["accuracy"]
        if char_accuracy < 100:
            incorrect = len(text_comp["expected"]) - text_comp["correct_chars"]
            feedback.append(f"\n- Character accuracy: {char_accuracy}% ({incorrect} characters need attention)")

        # Pinyin accuracy
        pinyin_accuracy = pinyin_comp["pinyin_accuracy"]
        if pinyin_accuracy < 100:
            incorrect_tones = pinyin_comp["total"] - pinyin_comp["matches"]
            feedback.append(f"- Tone accuracy: {pinyin_accuracy}% ({incorrect_tones} tones need work)")

        # Specific errors
        if self.feedback_detail in ["detailed", "verbose"]:
            errors = [cf for cf in text_comp["char_feedback"] if not cf["correct"]]
            if errors and len(errors) <= 5:
                feedback.append("\nSpecific corrections needed:")
                for error in errors:
                    expected_py = self.get_pinyin(error["expected"])[0][0]
                    feedback.append(f"- '{error['expected']}' ({expected_py}) was heard as '{error['actual']}'")

        return "\n".join(feedback)

    def _get_grade(self, score: float) -> str:
        """Convert numerical score to letter grade."""
        if score >= 95:
            return "A+"
        elif score >= 90:
            return "A"
        elif score >= 85:
            return "B+"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"


if __name__ == "__main__":
    # Test the pronunciation checker
    checker = PronunciationChecker()

    expected = "你好，我叫小明"
    actual = "你好，我叫小红"

    print("=== Pronunciation Evaluation Test ===")
    print(f"Expected: {expected}")
    print(f"Actual: {actual}\n")

    result = checker.evaluate_pronunciation(expected, actual)

    print(f"Overall Score: {result['overall_score']}%")
    print(f"Grade: {result['grade']}")
    print(f"\n{result['feedback_message']}")
