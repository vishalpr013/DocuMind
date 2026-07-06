create extension if not exists vector;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  pages integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  filename text not null,
  chunk_index integer not null,
  content text not null,
  page_start integer not null,
  page_end integer not null,
  embedding vector(768) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_document_id_idx
  on public.document_chunks(document_id);

create index if not exists document_chunks_embedding_idx
  on public.document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.match_document_chunks(
  query_embedding vector(768),
  match_count int default 5,
  filter_document_id uuid default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  filename text,
  content text,
  page_start integer,
  page_end integer,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    dc.id as chunk_id,
    dc.document_id,
    dc.filename,
    dc.content,
    dc.page_start,
    dc.page_end,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where filter_document_id is null or dc.document_id = filter_document_id
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

