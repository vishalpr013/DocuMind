from dataclasses import dataclass
from pathlib import Path

import pdfplumber


@dataclass(frozen=True)
class PageText:
    page_number: int
    text: str


def extract_pages(pdf_path: Path) -> list[PageText]:
    pages: list[PageText] = []
    with pdfplumber.open(pdf_path) as pdf:
        for index, page in enumerate(pdf.pages, start=1):
            text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
            cleaned = "\n".join(line.strip() for line in text.splitlines() if line.strip())
            pages.append(PageText(page_number=index, text=cleaned))
    return pages

