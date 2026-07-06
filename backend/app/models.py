from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class SourceChunk(BaseModel):
    chunk_id: str
    document_id: str
    filename: str
    page_start: int
    page_end: int
    content: str
    similarity: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    document_id: UUID | None = None
    top_k: int | None = Field(default=None, ge=1, le=20)


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]


class UploadResponse(BaseModel):
    document_id: str
    filename: str
    pages: int
    chunks: int

