"""EICAR test-file bytes — test fixtures only. Never import from production modules."""

from __future__ import annotations

# Classic EICAR antivirus test signature (harmless; detected by ClamAV).
# Kept out of src/ so production images do not embed it as an accidental fixture.
EICAR_BYTES = (
    b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
)


def write_eicar(path: str) -> None:
    with open(path, "wb") as handle:
        handle.write(EICAR_BYTES)
