from document_intelligence.extractors.base import ExtractionResult, SegmentDraft


def extract_xml_or_xer(data: bytes, extension: str) -> ExtractionResult:
    text = data.decode("utf-8", errors="replace")
    warnings = []
    if extension.lower() == "xer":
        warnings.append("schedule_parsing_pending")
    looks_xml = text.lstrip().startswith("<") or "<?xml" in text[:200]
    if extension.lower() == "xml" and not looks_xml:
        return ExtractionResult(
            status="FAILED",
            warnings=["xml_invalid_start"],
            content_may_be_incomplete=True,
        )

    return ExtractionResult(
        status="PARTIALLY_SUCCEEDED" if extension.lower() == "xer" else "SUCCEEDED",
        warnings=warnings,
        metadata={
            "byteLength": len(data),
            "format": extension.lower(),
            "scheduleInterpretation": "pending" if extension.lower() == "xer" else "n/a",
        },
        plain_text=text[:100_000],
        segments=[
            SegmentDraft(
                kind="METADATA_FIELD",
                ordinal=1,
                label="file-preview",
                text=text[:2000],
                locator={"schemaVersion": 1, "kind": "metadata_field", "label": "preview"},
            )
        ],
        ocr_used=False,
        content_may_be_incomplete=extension.lower() == "xer",
    )
