from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.chunking import RecursiveCharacterChunker
from app.config import Settings, get_settings
from app.models import ChatRequest, ChatResponse, UploadResponse
from app.gemini_client import GeminiService
from app.pdf_utils import extract_pages
from app.supabase_store import SupabaseVectorStore

app = FastAPI(title="DocuMind PDF RAG Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_gemini_service(settings: Settings = Depends(get_settings)) -> GeminiService:
    return GeminiService(settings)


def get_vector_store(settings: Settings = Depends(get_settings)) -> SupabaseVectorStore:
    return SupabaseVectorStore(settings)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/documents/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    gemini_service: GeminiService = Depends(get_gemini_service),
    vector_store: SupabaseVectorStore = Depends(get_vector_store),
) -> UploadResponse:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported")

    suffix = Path(file.filename).suffix
    with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = Path(tmp.name)

    try:
        pages = extract_pages(tmp_path)
        if not any(page.text for page in pages):
            raise HTTPException(status_code=400, detail="No extractable text found")

        chunker = RecursiveCharacterChunker(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
        chunks = chunker.split_pages(pages)
        embeddings = gemini_service.embed_texts([chunk.content for chunk in chunks])

        document_id = vector_store.create_document(file.filename, len(pages))
        vector_store.insert_chunks(document_id, file.filename, chunks, embeddings)

        return UploadResponse(
            document_id=document_id,
            filename=file.filename,
            pages=len(pages),
            chunks=len(chunks),
        )
    finally:
        tmp_path.unlink(missing_ok=True)


@app.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    settings: Settings = Depends(get_settings),
    gemini_service: GeminiService = Depends(get_gemini_service),
    vector_store: SupabaseVectorStore = Depends(get_vector_store),
) -> ChatResponse:
    top_k = request.top_k or settings.retrieval_top_k
    query_embedding = gemini_service.embed_texts([request.question])[0]
    sources = vector_store.match_chunks(
        query_embedding=query_embedding,
        top_k=top_k,
        document_id=str(request.document_id) if request.document_id else None,
    )

    if not sources:
        return ChatResponse(
            answer="I do not know based on the uploaded documents.",
            sources=[],
        )

    context = "\n\n".join(
        (
            f"[S{index}] {source.filename}, pages "
            f"{source.page_start}-{source.page_end}\n{source.content}"
        )
        for index, source in enumerate(sources, start=1)
    )
    answer = gemini_service.answer_question(request.question, context)
    return ChatResponse(answer=answer, sources=sources)


@app.get("/documents")
def list_documents(
    vector_store: SupabaseVectorStore = Depends(get_vector_store),
) -> list[dict]:
    return vector_store.list_documents()


@app.delete("/documents/{document_id}")
def delete_document(
    document_id: str,
    vector_store: SupabaseVectorStore = Depends(get_vector_store),
) -> dict[str, str]:
    vector_store.delete_document(document_id)
    return {"status": "success"}

