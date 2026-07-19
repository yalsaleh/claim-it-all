from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class SegmentDraft:
    kind: str
    ordinal: int
    label: Optional[str]
    text: Optional[str]
    locator: dict[str, Any]
    language: Optional[str] = None


@dataclass
class ExtractionResult:
    status: str  # SUCCEEDED | PARTIALLY_SUCCEEDED | FAILED
    warnings: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    plain_text: Optional[str] = None
    segments: list[SegmentDraft] = field(default_factory=list)
    ocr_used: bool = False
    content_may_be_incomplete: bool = False
