from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    gemini_api_key: str = Field(..., alias="GEMINI_API_KEY")
    gemini_chat_model: str = Field("gemini-2.5-flash", alias="GEMINI_CHAT_MODEL")
    gemini_embedding_model: str = Field(
        "text-embedding-004", alias="GEMINI_EMBEDDING_MODEL"
    )

    supabase_url: str = Field(..., alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(..., alias="SUPABASE_SERVICE_ROLE_KEY")

    chunk_size: int = Field(1200, alias="CHUNK_SIZE")
    chunk_overlap: int = Field(180, alias="CHUNK_OVERLAP")
    retrieval_top_k: int = Field(5, alias="RETRIEVAL_TOP_K")

    @field_validator(
        "gemini_api_key",
        "supabase_url",
        "supabase_service_role_key",
        mode="before",
    )
    @classmethod
    def clean_quotes(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip("'\" ")
        return v



@lru_cache
def get_settings() -> Settings:
    return Settings()
