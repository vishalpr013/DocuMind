# DocuMind - PDF RAG Assistant

FastAPI + React app for uploading PDFs, extracting page-aware chunks, embedding them with Google Gemini `gemini-embedding-2`, storing vectors in Supabase pgvector, and chatting with grounded source references.

### 🌐 Live Demo
* **Frontend:** [https://vishalpr013.github.io/DocuMind/](https://vishalpr013.github.io/DocuMind/)
* **Backend API:** [https://documind-backend-jvml.onrender.com/health](https://documind-backend-jvml.onrender.com/health)

---

## 🛠️ Stack

- **Backend:** FastAPI (Python)
- **PDF Extraction:** `pdfplumber` (highly accurate text extraction, with PyPDF fallback)
- **Chunking:** Custom recursive character chunker preserving page-number boundaries per chunk
- **Embeddings:** Google Gemini `gemini-embedding-2` (truncated to 768 dimensions)
- **Vector Database:** Supabase Postgres with `pgvector` extension
- **Frontend:** React + Tailwind CSS v4 + Vite

---

## 🧠 How Chunking & Retrieval Works

### 1. Document Parsing & Text Extraction
When a PDF is uploaded via `/documents/upload`, the backend uses `pdfplumber` to extract text page-by-page. By extracting text at the page level rather than the whole document, the application preserves the metadata mapping each text block to its specific page number.

### 2. Page-Aware Chunking
The extracted pages are processed by a custom `RecursiveCharacterChunker`:
* **Chunk Size:** 1200 characters.
* **Chunk Overlap:** 180 characters.
* **Page-Awareness:** Chunks are created sequentially. If a chunk spans across multiple pages, the chunk keeps track of the `page_start` and `page_end` so that the user receives accurate citations.

### 3. Embedding Generation
Each text chunk is sent to the Google Gen AI API using the `gemini-embedding-2` model to generate high-quality vector embeddings. The dimension is configured to `768` using Matryoshka Representation Learning (MRL), matching the database schema.

### 4. Vector Storage
The document metadata is saved in the `documents` table, and the chunks along with their vector embeddings, source filename, and page numbers are saved in the `document_chunks` table in Supabase.

### 5. Semantic Search & Retrieval (Cosine Similarity)
When a user asks a question via `/chat`:
1. The question is embedded using the same `gemini-embedding-2` model.
2. The embedding is sent to Supabase using a Remote Procedure Call (RPC) database function called `match_document_chunks`.
3. This function uses **Cosine Similarity** (`dc.embedding <=> query_embedding`) to find the top $K$ (default: 5) most semantically similar chunks matching the query.

### 6. Grounded Answer Generation
The retrieved chunks are formatted into a clean context block containing source metadata. This context, along with the user's question, is passed to `gemini-2.5-flash` with a system prompt instructing the model to *only* answer using the provided context and cite the sources using inline tags like `[S1]`, `[S2]`.


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

