import hashlib
import json
from typing import Any, Dict, Tuple, Union

MAX_KEY_LENGTH = 128

def validate_idempotency_key(key: str) -> Tuple[bool, str]:
    """
    Validates the client-supplied Idempotency-Key header.
    
    Rules:
    1. Key must be a string and not None.
    2. Key must not be empty or whitespace-only.
    3. Key length must be <= 128 characters.
    """
    if key is None:
        return False, "Idempotency-Key header is missing"
    
    if not isinstance(key, str):
        return False, "Idempotency-Key must be a string"
    
    stripped_key = key.strip()
    if not stripped_key:
        return False, "Idempotency-Key cannot be empty or whitespace"
    
    if len(stripped_key) > MAX_KEY_LENGTH:
        return False, f"Idempotency-Key exceeds maximum length of {MAX_KEY_LENGTH} characters"
    
    return True, ""


def generate_request_fingerprint(payload: Union[Dict[str, Any], str, bytes]) -> str:
    """
    Generates a deterministic SHA-256 fingerprint for an incoming request payload.
    
    Canonicalization ensures that equivalent JSON objects produce identical hashes
    regardless of whitespace or key ordering.
    """
    if isinstance(payload, bytes):
        payload_str = payload.decode('utf-8')
        try:
            payload_data = json.loads(payload_str)
        except Exception:
            payload_data = payload_str
    elif isinstance(payload, str):
        try:
            payload_data = json.loads(payload)
        except Exception:
            payload_data = payload
    else:
        payload_data = payload

    if isinstance(payload_data, (dict, list)):
        canonical_json = json.dumps(payload_data, sort_keys=True, separators=(',', ':'))
    else:
        canonical_json = str(payload_data)

    return hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()


def compare_fingerprints(fp1: str, fp2: str) -> bool:
    """Returns True if two request fingerprints are identical."""
    if not fp1 or not fp2:
        return False
    return fp1.strip().lower() == fp2.strip().lower()


def detect_duplicate(stored_fp: str, incoming_fp: str) -> bool:
    """Returns True if incoming request matches the stored payload fingerprint (retry scenario)."""
    return compare_fingerprints(stored_fp, incoming_fp)


def detect_conflict(stored_fp: str, incoming_fp: str) -> bool:
    """Returns True if incoming request reuses key with a different payload fingerprint (conflict scenario)."""
    return not compare_fingerprints(stored_fp, incoming_fp)
