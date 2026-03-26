"""
NoSocial agent identity — Ed25519 keypairs and DID derivation.

Each CrewAI agent gets a persistent NoSocial identity (keypair + DID).
Keys are stored as PEM files in a configurable directory.
"""

import hashlib
import json
import os
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
)

import base64


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _base64url_decode(s: str) -> bytes:
    padding = "=" * ((4 - len(s) % 4) % 4)
    return base64.urlsafe_b64decode(s + padding)


class AgentIdentity:
    """A NoSocial identity for a CrewAI agent."""

    def __init__(self, private_key: Ed25519PrivateKey):
        self._private_key = private_key
        self._public_key = private_key.public_key()
        raw_pub = self._public_key.public_bytes(Encoding.Raw, PublicFormat.Raw)
        self.public_key_str = f"ed25519:{_base64url_encode(raw_pub)}"
        self.did = f"did:nosocial:{hashlib.sha256(raw_pub).hexdigest()}"

    @classmethod
    def generate(cls) -> "AgentIdentity":
        """Generate a new random identity."""
        return cls(Ed25519PrivateKey.generate())

    @classmethod
    def load_or_create(cls, name: str, keys_dir: str = ".nosocial/keys") -> "AgentIdentity":
        """Load an existing identity for an agent name, or create one."""
        path = Path(keys_dir)
        path.mkdir(parents=True, exist_ok=True)
        key_file = path / f"{name}.pem"

        if key_file.exists():
            pem_data = key_file.read_bytes()
            from cryptography.hazmat.primitives.serialization import load_pem_private_key
            private_key = load_pem_private_key(pem_data, password=None)
            if not isinstance(private_key, Ed25519PrivateKey):
                raise ValueError(f"Key in {key_file} is not Ed25519")
            return cls(private_key)

        identity = cls.generate()
        pem_data = identity._private_key.private_bytes(
            Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()
        )
        key_file.write_bytes(pem_data)
        return identity

    def sign(self, obj: dict) -> str:
        """Sign a canonical JSON object, returning 'ed25519:{base64url}'."""
        message = _canonicalize(obj).encode("utf-8")
        sig = self._private_key.sign(message)
        return f"ed25519:{_base64url_encode(sig)}"


def _canonicalize(obj) -> str:
    """Recursive canonical JSON: keys sorted at every level, no whitespace."""
    if obj is None or isinstance(obj, (bool, int, float, str)):
        return json.dumps(obj)
    if isinstance(obj, list):
        return "[" + ",".join(_canonicalize(v) for v in obj) + "]"
    if isinstance(obj, dict):
        entries = sorted(obj.keys())
        parts = [json.dumps(k) + ":" + _canonicalize(obj[k]) for k in entries]
        return "{" + ",".join(parts) + "}"
    return json.dumps(obj)
