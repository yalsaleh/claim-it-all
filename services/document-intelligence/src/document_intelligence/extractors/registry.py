from document_intelligence.extractors.base import ExtractionResult
from document_intelligence.extractors.docx_ext import extract_docx
from document_intelligence.extractors.eml import extract_eml
from document_intelligence.extractors.image import extract_image
from document_intelligence.extractors.pdf import extract_pdf
from document_intelligence.extractors.text_csv import extract_text_or_csv
from document_intelligence.extractors.xlsx_ext import extract_xlsx
from document_intelligence.extractors.xml_xer import extract_xml_or_xer


def extract_for_media(media_type: str, extension: str, data: bytes) -> ExtractionResult:
    ext = (extension or "").lower()
    if media_type == "application/pdf" or ext == "pdf":
        return extract_pdf(data)
    if "wordprocessingml" in media_type or ext == "docx":
        return extract_docx(data)
    if "spreadsheetml" in media_type or ext == "xlsx":
        return extract_xlsx(data)
    if media_type == "text/csv" or ext == "csv":
        return extract_text_or_csv(data, "csv")
    if media_type == "text/plain" or ext in {"txt", "xer"}:
        if ext == "xer":
            return extract_xml_or_xer(data, "xer")
        return extract_text_or_csv(data, "txt")
    if media_type == "message/rfc822" or ext == "eml":
        return extract_eml(data)
    if media_type in {"application/xml", "text/xml"} or ext == "xml":
        return extract_xml_or_xer(data, "xml")
    if media_type.startswith("image/") or ext in {"png", "jpg", "jpeg", "tif", "tiff"}:
        return extract_image(data)
    if ext == "msg":
        return ExtractionResult(
            status="FAILED",
            warnings=["msg_unsupported"],
            content_may_be_incomplete=True,
        )
    return ExtractionResult(
        status="FAILED",
        warnings=["unsupported_format"],
        content_may_be_incomplete=True,
    )
