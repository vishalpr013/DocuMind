from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import Settings


class GeminiService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = genai.Client(api_key=settings.gemini_api_key)

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True
    )
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        
        wrapped_contents = [
            types.Content(parts=[types.Part(text=t)]) for t in texts
        ]
        response = self.client.models.embed_content(
            model=self.settings.gemini_embedding_model,
            contents=wrapped_contents,
            config=types.EmbedContentConfig(output_dimensionality=768)
        )
        return [emb.values for emb in response.embeddings]

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True
    )
    def answer_question(self, question: str, context: str) -> str:
        prompt = (
            "You are a precise document QA assistant. Answer only from the provided "
            "context. If the answer is not supported, say you do not know based on "
            "the uploaded documents. Cite sources inline using [S1], [S2], etc.\n\n"
            f"Context:\n{context}\n\nQuestion: {question}"
        )
        response = self.client.models.generate_content(
            model=self.settings.gemini_chat_model,
            contents=prompt,
        )
        return response.text
