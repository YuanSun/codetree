"""Tests for pronunciation checker."""

import pytest
from pronunciation_checker import PronunciationChecker


@pytest.fixture
def checker():
    """Create a pronunciation checker instance."""
    return PronunciationChecker()


def test_get_pinyin(checker):
    """Test pinyin conversion."""
    text = "你好"
    result = checker.get_pinyin(text, with_tone=True)
    assert len(result) == 2
    assert result[0][0] == "nǐ"
    assert result[1][0] == "hǎo"


def test_compare_texts_perfect_match(checker):
    """Test comparison with perfect match."""
    expected = "你好"
    actual = "你好"
    result = checker.compare_texts(expected, actual)

    assert result["accuracy"] == 100.0
    assert result["correct_chars"] == 2
    assert result["total_chars"] == 2


def test_compare_texts_partial_match(checker):
    """Test comparison with partial match."""
    expected = "你好吗"
    actual = "你好啊"
    result = checker.compare_texts(expected, actual)

    assert result["accuracy"] < 100.0
    assert result["correct_chars"] == 2
    assert result["total_chars"] == 3


def test_compare_texts_no_match(checker):
    """Test comparison with no match."""
    expected = "你好"
    actual = "再见"
    result = checker.compare_texts(expected, actual)

    assert result["accuracy"] == 0.0
    assert result["correct_chars"] == 0


def test_compare_pinyin(checker):
    """Test pinyin comparison."""
    expected = "你好"
    actual = "你好"
    result = checker.compare_pinyin(expected, actual)

    assert result["pinyin_accuracy"] == 100.0
    assert result["matches"] == 2


def test_evaluate_pronunciation_perfect(checker):
    """Test pronunciation evaluation with perfect match."""
    expected = "你好"
    actual = "你好"
    result = checker.evaluate_pronunciation(expected, actual)

    assert result["overall_score"] == 100.0
    assert result["grade"] == "A+"
    assert "Excellent" in result["feedback_message"]


def test_evaluate_pronunciation_good(checker):
    """Test pronunciation evaluation with good match."""
    expected = "你好世界"
    actual = "你好世间"
    result = checker.evaluate_pronunciation(expected, actual)

    assert result["overall_score"] >= 70.0
    assert result["grade"] in ["A", "B+", "B", "C"]


def test_evaluate_pronunciation_needs_work(checker):
    """Test pronunciation evaluation with poor match."""
    expected = "你好世界"
    actual = "再见朋友"
    result = checker.evaluate_pronunciation(expected, actual)

    assert result["overall_score"] < 70.0
    assert "practice" in result["feedback_message"].lower() or "work" in result["feedback_message"].lower()


def test_grade_assignment(checker):
    """Test grade assignment based on score."""
    assert checker._get_grade(98) == "A+"
    assert checker._get_grade(92) == "A"
    assert checker._get_grade(87) == "B+"
    assert checker._get_grade(82) == "B"
    assert checker._get_grade(72) == "C"
    assert checker._get_grade(62) == "D"
    assert checker._get_grade(45) == "F"
