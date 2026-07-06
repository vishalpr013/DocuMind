from typing import Any

from supabase import Client, create_client

from app.chunking import TextChunk
from app.config import Settings
from app.models import SourceChunk


class SupabaseVectorStore:
    def __init__(self, settings: Settings) -> None:
        self.client: Client = create_client(
            settings.supabase_url, settings.supabase_service_role_key
        )

    def create_document(self, filename: str, pages: int) -> str:
        result = (
            self.client.table("documents")
            .insert({"filename": filename, "pages": pages})
            .execute()
        )
        return result.data[0]["id"]

    def insert_chunks(
        self,
        document_id: str,
        filename: str,
        chunks: list[TextChunk],
        embeddings: list[list[float]],
    ) -> None:
        rows: list[dict[str, Any]] = []
        for chunk, embedding in zip(chunks, embeddings, strict=True):
            rows.append(
                {
                    "document_id": document_id,
                    "filename": filename,
                    "chunk_index": chunk.chunk_index,
                    "content": chunk.content,
                    "page_start": chunk.page_start,
                    "page_end": chunk.page_end,
                    "embedding": embedding,
                    "metadata": {},
                }
            )
        if rows:
            self.client.table("document_chunks").insert(rows).execute()

    def match_chunks(
        self,
        query_embedding: list[float],
        top_k: int,
        document_id: str | None = None,
    ) -> list[SourceChunk]:
        result = self.client.rpc(
            "match_document_chunks",
            {
                "query_embedding": query_embedding,
                "match_count": top_k,
                "filter_document_id": document_id,
            },
        ).execute()
        return [
            SourceChunk(
                chunk_id=row["chunk_id"],
                document_id=row["document_id"],
                filename=row["filename"],
                page_start=row["page_start"],
                page_end=row["page_end"],
                content=row["content"],
                similarity=row.get("similarity"),
                metadata=row.get("metadata") or {},
            )
            for row in result.data
        ]

    def list_documents(self) -> list[dict[str, Any]]:
        result = (
            self.client.table("documents")
            .select("id, filename, pages, created_at")
            .order("created_at", desc=True)
            .execute()
        )
        return result.data

    def delete_document(self, document_id: str) -> None:
        self.client.table("documents").delete().eq("id", document_id).execute()


