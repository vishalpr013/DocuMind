# DocuMind - PDF RAG Assistant

FastAPI + React app for uploading PDFs, extracting page-aware chunks, embedding them with Google Gemini `gemini-embedding-2`, storing vectors in Supabase pgvector, and chatting with grounded source references.

## Stack

- Backend: FastAPI
- PDF extraction: pdfplumber, with PyPDF fallback metadata support
- Chunking: recursive character chunker with page numbers tracked per chunk
- Embeddings: Google Gemini `gemini-embedding-2` (truncated to 768 dimensions)
- Vector DB: Supabase Postgres with pgvector
- Frontend: React + Tailwind CSS v4 + Vite

## Setup

1. Create a Supabase project.
2. In Supabase SQL editor, run [supabase/schema.sql](supabase/schema.sql).
3. Copy `.env.example` to `.env` and fill in values.
4. Install and start the API (Backend):

```powershell
# Create and activate virtual environment at root
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies from the backend folder
pip install -r backend/requirements.txt

# Run the server from the backend folder
cd backend
python -m uvicorn app.main:app --reload
```

5. Install and start the UI (Frontend):

```powershell
cd frontend
npm install
npm run dev
```

The API defaults to `http://localhost:8000`. The React dashboard UI reads `VITE_API_BASE_URL` from the environment and falls back to `http://localhost:8000`.

## Environment

Required:

- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `GEMINI_CHAT_MODEL`, default `gemini-2.5-flash`
- `GEMINI_EMBEDDING_MODEL`, default `text-embedding-004`
- `CHUNK_SIZE`, default `1200`
- `CHUNK_OVERLAP`, default `180`
- `RETRIEVAL_TOP_K`, default `5`

## API

### `POST /documents/upload`

Multipart form field: `file`.

Returns the document id and number of chunks inserted.

### `POST /chat`

```json
{
  "question": "What does the document say about refunds?",
  "document_id": "optional-document-uuid",
  "top_k": 5
}
```

Returns an answer and the source chunks used to ground it.

