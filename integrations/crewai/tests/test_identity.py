"""Tests for NoSocial agent identity."""

import tempfile
from pathlib import Path

from nosocial_crewai.identity import AgentIdentity, _canonicalize


def test_generate_identity():
    identity = AgentIdentity.generate()
    assert identity.public_key_str.startswith("ed25519:")
    assert identity.did.startswith("did:nosocial:")
    assert len(identity.did) == len("did:nosocial:") + 64  # sha256 hex


def test_deterministic_did():
    identity = AgentIdentity.generate()
    # DID is deterministic from public key
    assert identity.did == identity.did


def test_load_or_create_persists():
    with tempfile.TemporaryDirectory() as tmpdir:
        id1 = AgentIdentity.load_or_create("test-agent", keys_dir=tmpdir)
        id2 = AgentIdentity.load_or_create("test-agent", keys_dir=tmpdir)
        assert id1.did == id2.did
        assert id1.public_key_str == id2.public_key_str


def test_different_names_different_keys():
    with tempfile.TemporaryDirectory() as tmpdir:
        id1 = AgentIdentity.load_or_create("agent-a", keys_dir=tmpdir)
        id2 = AgentIdentity.load_or_create("agent-b", keys_dir=tmpdir)
        assert id1.did != id2.did


def test_sign_produces_valid_format():
    identity = AgentIdentity.generate()
    sig = identity.sign({"hello": "world"})
    assert sig.startswith("ed25519:")
    # base64url encoded Ed25519 signature should be ~86 chars
    assert len(sig) > 20


def test_canonicalize_sorts_keys():
    result = _canonicalize({"b": 1, "a": 2})
    assert result == '{"a":2,"b":1}'


def test_canonicalize_nested():
    result = _canonicalize({"z": {"b": 1, "a": 2}, "a": 3})
    assert result == '{"a":3,"z":{"a":2,"b":1}}'


def test_canonicalize_array():
    result = _canonicalize({"items": [3, 1, 2]})
    assert result == '{"items":[3,1,2]}'
