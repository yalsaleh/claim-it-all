from charset_normalizer import from_bytes

from document_intelligence.extractors.base import ExtractionResult, SegmentDraft


def extract_text_or_csv(data: bytes, kind: str) -> ExtractionResult:
    detected = from_bytes(data).best()
    if detected is None:
        return ExtractionResult(
            status="FAILED",
            warnings=["encoding_undetected"],
            content_may_be_incomplete=True,
        )
    text = str(detected)
    encoding = detected.encoding
    lines = text.splitlines()
    segments: list[SegmentDraft] = []
    chunk_size = 50
    for index in range(0, len(lines), chunk_size):
        chunk_lines = lines[index : index + chunk_size]
        ordinal = index // chunk_size + 1
        chunk = "\n".join(chunk_lines)
        segments.append(
            SegmentDraft(
                kind="LINE_CHUNK",
                ordinal=ordinal,
                label=f"lines {index + 1}-{index + len(chunk_lines)}",
                text=chunk,
                locator={
                    "schemaVersion": 1,
                    "kind": "line_chunk",
                    "label": f"{index + 1}:{index + len(chunk_lines)}",
                },
            )
        )

    return ExtractionResult(
        status="SUCCEEDED",
        warnings=[],
        metadata={"encoding": encoding, "lineCount": len(lines), "format": kind},
        plain_text=text,
        segments=segments,
        ocr_used=False,
        content_may_be_incomplete=False,
    )
