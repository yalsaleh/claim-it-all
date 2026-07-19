from io import BytesIO
from typing import List

from pypdf import PdfReader

from document_intelligence.config import get_settings
from document_intelligence.extractors.base import ExtractionResult, SegmentDraft


def extract_pdf(data: bytes) -> ExtractionResult:
    settings = get_settings()
    warnings: List[str] = []
    try:
        reader = PdfReader(BytesIO(data))
    except Exception as exc:  # noqa: BLE001
        return ExtractionResult(
            status="FAILED",
            warnings=[f"pdf_parse_error:{exc.__class__.__name__}"],
            content_may_be_incomplete=True,
        )

    page_count = len(reader.pages)
    if page_count > settings.max_pdf_pages:
        return ExtractionResult(
            status="FAILED",
            warnings=["pdf_too_many_pages"],
            metadata={"pageCount": page_count},
            content_may_be_incomplete=True,
        )

    segments: list[SegmentDraft] = []
    texts: list[str] = []
    empty_pages = 0
    for index, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception:  # noqa: BLE001
            text = ""
            warnings.append(f"page_extract_error:{index}")
        if not text.strip():
            empty_pages += 1
            warnings.append(f"page_likely_needs_ocr:{index}")
        texts.append(text)
        segments.append(
            SegmentDraft(
                kind="PAGE",
                ordinal=index,
                label=f"Page {index}",
                text=text or None,
                locator={"schemaVersion": 1, "kind": "page", "pageNumber": index},
            )
        )

    meta = {
        "pageCount": page_count,
        "emptyPageCount": empty_pages,
        "ocrRecommended": empty_pages > 0,
    }
    status = "SUCCEEDED"
    if empty_pages == page_count and page_count > 0:
        status = "PARTIALLY_SUCCEEDED"
        warnings.append("no_embedded_text_ocr_not_run")
    elif warnings:
        status = "PARTIALLY_SUCCEEDED"

    return ExtractionResult(
        status=status,
        warnings=warnings,
        metadata=meta,
        plain_text="\n\n".join(texts),
        segments=segments,
        ocr_used=False,
        content_may_be_incomplete=empty_pages > 0,
    )
