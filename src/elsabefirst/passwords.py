"""Password hashing using the standard library's scrypt implementation."""

import hashlib
import hmac
import secrets

SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
KEY_LENGTH = 32
ALGORITHM = "scrypt"


def _derive(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=n,
        r=r,
        p=p,
        dklen=KEY_LENGTH,
        maxmem=128 * r * (n + p + 2) + 1024 * 1024,
    )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    key = _derive(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P)
    return f"{ALGORITHM}${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${key.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, n, r, p, salt_hex, key_hex = stored.split("$")
        if algorithm != ALGORITHM:
            return False
        key = _derive(password, bytes.fromhex(salt_hex), int(n), int(r), int(p))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(key, bytes.fromhex(key_hex))


# Used to keep response timing similar when the account does not exist or has
# no password, so attackers cannot cheaply probe which accounts have passwords.
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))
