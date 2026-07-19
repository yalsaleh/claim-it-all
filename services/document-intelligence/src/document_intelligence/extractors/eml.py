import email
from email.message import Message

from document_intelligence.extractors.base import ExtractionResult, SegmentDraft


def _part_text(part: Message) -> str:
    payload = part.get_payload(decode=True)
    if isinstance(payload, bytes):
        charset = part.get_content_charset() or "utf-8"
        return payload.decode(charset, errors="replace")
    if isinstance(payload, str):
        return payload
    return ""


def extract_eml(data: bytes) -> ExtractionResult:
    try:
        message = email.message_from_bytes(data)
    except Exception as exc:  # noqa: BLE001
        return ExtractionResult(
            status="FAILED",
            warnings=[f"eml_parse_error:{exc.__class__.__name__}"],
            content_may_be_incomplete=True,
        )

    subject = str(message.get("subject", ""))
    sender = str(message.get("from", ""))
    to = str(message.get("to", ""))
    date = str(message.get("date", ""))
    segments = [
        SegmentDraft(
            kind="EMAIL_HEADER",
            ordinal=1,
            label="headers",
            text=f"From: {sender}\nTo: {to}\nSubject: {subject}\nDate: {date}",
            locator={"schemaVersion": 1, "kind": "email_header"},
        )
    ]

    body_parts: list[str] = []
    attachments: list[str] = []
    if message.is_multipart():
        for part in message.walk():
            disposition = str(part.get("Content-Disposition") or "")
            filename = part.get_filename()
            if filename or "attachment" in disposition.lower():
                attachments.append(filename or "unnamed-attachment")
                continue
            if part.get_content_type() == "text/plain":
                try:
                    body_parts.append(_part_text(part))
                except Exception:  # noqa: BLE001
                    pass
    else:
        try:
            body_parts.append(_part_text(message))
        except Exception:  # noqa: BLE001
            pass

    body = "\n".join(body_parts)
    segments.append(
        SegmentDraft(
            kind="EMAIL_BODY",
            ordinal=2,
            label="body",
            text=body or None,
            locator={"schemaVersion": 1, "kind": "email_body"},
        )
    )
    for index, name in enumerate(attachments, start=1):
        segments.append(
            SegmentDraft(
                kind="ATTACHMENT",
                ordinal=2 + index,
                label=name,
                text=None,
                locator={"schemaVersion": 1, "kind": "attachment", "label": name},
            )
        )

    return ExtractionResult(
        status="SUCCEEDED",
        warnings=[] if not attachments else ["attachments_manifest_only"],
        metadata={
            "subject": subject,
            "from": sender,
            "attachmentCount": len(attachments),
            "attachments": attachments,
        },
        plain_text=f"{subject}\n\n{body}",
        segments=segments,
        ocr_used=False,
        content_may_be_incomplete=bool(attachments),
    )
