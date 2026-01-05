"""
AI-powered tutor for Chinese language learning.
Provides explanations, cultural context, and personalized guidance.
"""

import os
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
from pypinyin import pinyin, Style

load_dotenv()


class AITutor:
    """
    AI tutor that explains Chinese textbook content and provides learning guidance.
    Supports both Anthropic Claude and OpenAI GPT models.
    """

    def __init__(self):
        """Initialize the AI tutor with configured provider."""
        self.provider = os.getenv("AI_PROVIDER", "anthropic").lower()
        self.model = os.getenv("AI_MODEL", "claude-3-5-sonnet-20241022")
        self.difficulty = os.getenv("DIFFICULTY_LEVEL", "beginner")

        # Initialize the appropriate client
        if self.provider == "anthropic":
            try:
                from anthropic import Anthropic
                api_key = os.getenv("ANTHROPIC_API_KEY")
                if not api_key:
                    raise ValueError("ANTHROPIC_API_KEY not set in environment")
                self.client = Anthropic(api_key=api_key)
                self.chat_function = self._chat_anthropic
            except ImportError:
                raise ImportError("anthropic package not installed. Run: pip install anthropic")
        elif self.provider == "openai":
            try:
                from openai import OpenAI
                api_key = os.getenv("OPENAI_API_KEY")
                if not api_key:
                    raise ValueError("OPENAI_API_KEY not set in environment")
                self.client = OpenAI(api_key=api_key)
                self.chat_function = self._chat_openai
            except ImportError:
                raise ImportError("openai package not installed. Run: pip install openai")
        else:
            raise ValueError(f"Unsupported AI provider: {self.provider}")

        self.conversation_history = []

    def _chat_anthropic(self, messages: List[Dict[str, str]]) -> str:
        """Send chat request to Anthropic Claude."""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=2000,
            messages=messages
        )
        return response.content[0].text

    def _chat_openai(self, messages: List[Dict[str, str]]) -> str:
        """Send chat request to OpenAI GPT."""
        # OpenAI needs system message separate
        system_msg = next((m["content"] for m in messages if m["role"] == "system"), None)
        user_messages = [m for m in messages if m["role"] != "system"]

        kwargs = {"model": self.model, "messages": user_messages}
        if system_msg:
            kwargs["messages"].insert(0, {"role": "system", "content": system_msg})

        response = self.client.chat.completions.create(**kwargs)
        return response.choices[0].message.content

    def explain_text(self, chinese_text: str, context: str = "") -> str:
        """
        Explain Chinese text in English with cultural context.

        Args:
            chinese_text: Chinese text to explain
            context: Optional context (e.g., "from textbook lesson 3")

        Returns:
            Detailed explanation in English
        """
        # Get pinyin for the text
        pinyin_text = " ".join([p[0] for p in pinyin(chinese_text, style=Style.TONE)])

        system_prompt = f"""You are an expert Chinese language tutor helping an English-speaking child learn Chinese.
Your student is at {self.difficulty} level.

Provide clear, engaging explanations that include:
1. Character-by-character breakdown with pinyin and meaning
2. Grammar structure explanation
3. Cultural context when relevant
4. Example sentences for practice
5. Common mistakes to avoid

Keep explanations simple and encouraging for a child learning Chinese."""

        user_prompt = f"""Please explain this Chinese text:

Chinese: {chinese_text}
Pinyin: {pinyin_text}
{f'Context: {context}' if context else ''}

Explain what it means, how to use it, and any cultural notes that would help a child understand better."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        response = self.chat_function(messages)
        return response

    def check_pronunciation_with_ai(
        self,
        expected: str,
        actual: str,
        pronunciation_data: Dict[str, Any]
    ) -> str:
        """
        Get AI-powered pronunciation feedback.

        Args:
            expected: Expected text
            actual: What was spoken
            pronunciation_data: Data from pronunciation checker

        Returns:
            Personalized feedback message
        """
        expected_pinyin = " ".join([p[0] for p in pinyin(expected, style=Style.TONE)])
        actual_pinyin = " ".join([p[0] for p in pinyin(actual, style=Style.TONE)])

        system_prompt = f"""You are a patient Chinese pronunciation tutor for an English-speaking child.
Provide encouraging, specific feedback on pronunciation mistakes.
Focus on tones and common challenges for English speakers."""

        user_prompt = f"""The student tried to say:
Expected: {expected} ({expected_pinyin})

But said:
Actual: {actual} ({actual_pinyin})

Score: {pronunciation_data.get('overall_score', 0)}%

Provide specific, encouraging feedback on:
1. What they did well
2. Which tones need work
3. Helpful tips for improvement
4. Practice suggestions

Keep it positive and suitable for a child!"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        response = self.chat_function(messages)
        return response

    def answer_question(self, question: str, lesson_context: str = "") -> str:
        """
        Answer student questions about Chinese language and culture.

        Args:
            question: Student's question
            lesson_context: Current lesson context

        Returns:
            Answer to the question
        """
        system_prompt = f"""You are a knowledgeable Chinese language tutor for an English-speaking child.
Answer questions clearly and simply. Use examples when helpful.
Student level: {self.difficulty}"""

        context_info = f"\nCurrent lesson context: {lesson_context}" if lesson_context else ""
        user_prompt = f"{question}{context_info}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        response = self.chat_function(messages)
        return response

    def generate_practice_exercises(self, lesson_content: str, num_exercises: int = 5) -> str:
        """
        Generate practice exercises based on lesson content.

        Args:
            lesson_content: The lesson text/topic
            num_exercises: Number of exercises to generate

        Returns:
            Practice exercises
        """
        system_prompt = f"""You are creating practice exercises for a {self.difficulty} level Chinese student.
Make exercises engaging and appropriate for children."""

        user_prompt = f"""Based on this lesson content:
{lesson_content}

Create {num_exercises} practice exercises including:
1. Fill-in-the-blank sentences
2. Translation practice (English to Chinese)
3. Tone practice
4. Character writing practice

Make them fun and engaging!"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        response = self.chat_function(messages)
        return response

    def get_cultural_note(self, topic: str) -> str:
        """
        Get cultural information about a Chinese topic.

        Args:
            topic: Topic to explain (e.g., "Spring Festival", "chopsticks")

        Returns:
            Cultural explanation
        """
        system_prompt = """You are a cultural educator explaining Chinese culture to children.
Make explanations interesting and relatable."""

        user_prompt = f"Explain the cultural significance of '{topic}' in Chinese culture. Keep it simple and interesting for a child learning Chinese."

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        response = self.chat_function(messages)
        return response


if __name__ == "__main__":
    # Test the AI tutor
    tutor = AITutor()

    print("=== AI Tutor Test ===\n")

    # Test explanation
    chinese_text = "你好，我叫小明。"
    print(f"Explaining: {chinese_text}\n")
    explanation = tutor.explain_text(chinese_text, context="Lesson 1: Introductions")
    print(explanation)

    print("\n" + "="*50 + "\n")

    # Test question answering
    question = "What's the difference between 的, 地, and 得?"
    print(f"Question: {question}\n")
    answer = tutor.answer_question(question)
    print(answer)
