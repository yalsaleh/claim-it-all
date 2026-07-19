from dataclasses import dataclass
from typing import Optional, Protocol


@dataclass(frozen=True)
class OcrPageResult:
    page_number: int
    text: str
    confidence: Optional[float]
    language_hints: list[str]


class OcrProvider(Protocol):
    """Provider-neutral OCR boundary. No commercial provider is called in Slice 2."""

    def supports_arabic(self) -> bool: ...

    def ocr_page(self, image_bytes: bytes, page_number: int) -> OcrPageResult: ...


class NullOcrProvider:
    def supports_arabic(self) -> bool:
        return False

    def ocr_page(self, image_bytes: bytes, page_number: int) -> OcrPageResult:
        raise RuntimeError("OCR_NOT_CONFIGURED")
