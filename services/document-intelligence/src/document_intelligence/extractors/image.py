from io import BytesIO

from PIL import Image

from document_intelligence.extractors.base import ExtractionResult, SegmentDraft


def extract_image(data: bytes) -> ExtractionResult:
    try:
        image = Image.open(BytesIO(data))
        image.load()
    except Exception as exc:  # noqa: BLE001
        return ExtractionResult(
            status="FAILED",
            warnings=[f"image_parse_error:{exc.__class__.__name__}"],
            content_may_be_incomplete=True,
        )

    meta = {
        "format": image.format,
        "width": image.width,
        "height": image.height,
        "mode": image.mode,
        "textExtracted": False,
        "ocrPending": True,
    }
    return ExtractionResult(
        status="PARTIALLY_SUCCEEDED",
        warnings=["image_text_not_extracted_ocr_not_run"],
        metadata=meta,
        plain_text=None,
        segments=[
            SegmentDraft(
                kind="METADATA_FIELD",
                ordinal=1,
                label="image-dimensions",
                text=f"{image.width}x{image.height}",
                locator={"schemaVersion": 1, "kind": "metadata_field", "label": "dimensions"},
            )
        ],
        ocr_used=False,
        content_may_be_incomplete=True,
    )
