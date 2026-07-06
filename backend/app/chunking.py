from dataclasses import dataclass

from app.pdf_utils import PageText


@dataclass(frozen=True)
class TextChunk:
    content: str
    page_start: int
    page_end: int
    chunk_index: int


class RecursiveCharacterChunker:
    def __init__(self, chunk_size: int, chunk_overlap: int) -> None:
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be smaller than chunk_size")
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = ["\n\n", "\n", ". ", " ", ""]

    def split_pages(self, pages: list[PageText]) -> list[TextChunk]:
        page_spans: list[tuple[int, int, int]] = []
        full_text_parts: list[str] = []
        cursor = 0

        for page in pages:
            marker = f"\n\n[Page {page.page_number}]\n"
            page_text = marker + page.text
            start = cursor
            full_text_parts.append(page_text)
            cursor += len(page_text)
            page_spans.append((start, cursor, page.page_number))

        full_text = "".join(full_text_parts).strip()
        raw_chunks = self._split_text(full_text)

        chunks: list[TextChunk] = []
        search_from = 0
        for index, content in enumerate(raw_chunks):
            start = full_text.find(content, search_from)
            if start == -1:
                start = search_from
            end = start + len(content)
            search_from = max(start + 1, end - self.chunk_overlap)
            pages_in_chunk = [
                page_number
                for span_start, span_end, page_number in page_spans
                if span_start < end and span_end > start
            ]
            chunks.append(
                TextChunk(
                    content=content.strip(),
                    page_start=min(pages_in_chunk) if pages_in_chunk else 1,
                    page_end=max(pages_in_chunk) if pages_in_chunk else 1,
                    chunk_index=index,
                )
            )
        return [chunk for chunk in chunks if chunk.content]

    def _split_text(self, text: str) -> list[str]:
        if len(text) <= self.chunk_size:
            return [text]

        chunks: list[str] = []
        self._split_recursive(text, chunks)
        return self._merge_small_chunks(chunks)

    def _split_recursive(self, text: str, chunks: list[str]) -> None:
        if len(text) <= self.chunk_size:
            chunks.append(text)
            return

        separator = next((sep for sep in self.separators if sep and sep in text), "")
        if separator:
            parts = text.split(separator)
            current = ""
            for part in parts:
                candidate = f"{current}{separator}{part}" if current else part
                if len(candidate) <= self.chunk_size:
                    current = candidate
                else:
                    if current:
                        chunks.append(current)
                    if len(part) > self.chunk_size:
                        self._split_recursive(part, chunks)
                        current = ""
                    else:
                        current = part
            if current:
                chunks.append(current)
            return

        for start in range(0, len(text), self.chunk_size):
            chunks.append(text[start : start + self.chunk_size])

    def _merge_small_chunks(self, chunks: list[str]) -> list[str]:
        merged: list[str] = []
        current = ""
        for chunk in chunks:
            candidate = f"{current}\n{chunk}".strip() if current else chunk
            if len(candidate) <= self.chunk_size:
                current = candidate
            else:
                if current:
                    merged.append(current)
                current = chunk
        if current:
            merged.append(current)

        if self.chunk_overlap <= 0:
            return merged

        overlapped: list[str] = []
        previous_tail = ""
        for chunk in merged:
            combined = f"{previous_tail}\n{chunk}".strip() if previous_tail else chunk
            overlapped.append(combined[-self.chunk_size :])
            previous_tail = chunk[-self.chunk_overlap :]
        return overlapped

