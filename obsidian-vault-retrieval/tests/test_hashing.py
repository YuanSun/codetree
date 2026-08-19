from vault_retrieval.hashing import content_hash


def test_same_content_same_hash():
    assert content_hash("hello world") == content_hash("hello world")


def test_different_content_different_hash():
    assert content_hash("hello world") != content_hash("hello there")


def test_hash_is_hex_sha256_length():
    assert len(content_hash("x")) == 64
