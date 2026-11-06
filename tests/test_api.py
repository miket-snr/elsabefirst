from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from elsabefirst.main import create_app


@pytest.fixture
def client(tmp_path: Path):
    app = create_app(tmp_path / "test.db")
    with TestClient(app) as test_client:
        yield test_client


def sign_in(client: TestClient) -> tuple[str, dict]:
    requested = client.post(
        "/api/auth/request-otp", json={"identifier": "demo@example.com"}
    )
    assert requested.status_code == 200
    verified = client.post(
        "/api/auth/verify-otp",
        json={
            "temporary_token": requested.json()["temporary_token"],
            "otp": "Hellothere",
        },
    )
    assert verified.status_code == 200
    body = verified.json()
    return body["token"], body["user"]


def user_payload(**overrides) -> dict[str, str]:
    return {
        "username": "casey",
        "firstnames": "Casey",
        "surname": "Taylor",
        "email": "casey@example.com",
        "cellno": "+15550101001",
        "validfrom": "2026-01-01",
        "validto": "2027-01-01",
        **overrides,
    }


def test_root_shows_api_links(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {
        "message": "Elsabefirst API is running",
        "docs": "/docs",
        "health": "/api/health",
    }


def test_cors_allows_vite_fallback_port(client: TestClient):
    response = client.options(
        "/api/auth/request-otp",
        headers={
            "Origin": "http://127.0.0.1:5174",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5174"


def test_cors_rejects_non_local_origins_by_default(client: TestClient):
    response = client.options(
        "/api/auth/request-otp",
        headers={
            "Origin": "https://example.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_demo_user_can_complete_otp_login_and_validate_token(client: TestClient):
    requested = client.post(
        "/api/auth/request-otp", json={"identifier": "+15550101000"}
    )
    assert requested.status_code == 200

    result = client.post(
        "/api/auth/verify-otp",
        json={
            "temporary_token": requested.json()["temporary_token"],
            "otp": "Hellothere",
        },
    )
    assert result.status_code == 200
    token = result.json()["token"]
    assert result.json()["user"]["email"] == "demo@example.com"

    validated = client.get(
        "/api/auth/userhandler", headers={"Authorization": f"Bearer {token}"}
    )
    assert validated.status_code == 200
    assert validated.json()["username"] == "demo"


def test_invalid_otp_does_not_consume_temporary_token(client: TestClient):
    requested = client.post(
        "/api/auth/request-otp", json={"identifier": "demo@example.com"}
    )
    temporary_token = requested.json()["temporary_token"]

    rejected = client.post(
        "/api/auth/verify-otp",
        json={"temporary_token": temporary_token, "otp": "wrong"},
    )
    assert rejected.status_code == 400

    accepted = client.post(
        "/api/auth/verify-otp",
        json={"temporary_token": temporary_token, "otp": "Hellothere"},
    )
    assert accepted.status_code == 200


def test_temporary_token_can_only_be_used_once(client: TestClient):
    requested = client.post(
        "/api/auth/request-otp", json={"identifier": "demo@example.com"}
    )
    payload = {
        "temporary_token": requested.json()["temporary_token"],
        "otp": "Hellothere",
    }

    assert client.post("/api/auth/verify-otp", json=payload).status_code == 200
    assert client.post("/api/auth/verify-otp", json=payload).status_code == 401


def test_users_can_be_created_listed_and_updated(client: TestClient):
    token, _ = sign_in(client)
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post("/api/users", json=user_payload(), headers=headers)
    assert created.status_code == 201
    user_id = created.json()["id"]
    assert created.json()["validto"] == "2027-01-01"

    users = client.get("/api/users", headers=headers)
    assert users.status_code == 200
    assert {user["username"] for user in users.json()} == {"demo", "casey"}

    updated = client.put(
        f"/api/users/{user_id}",
        json=user_payload(firstnames="Casey Lee"),
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["firstnames"] == "Casey Lee"


def test_users_api_requires_a_valid_token(client: TestClient):
    assert client.get("/api/users").status_code == 401
    assert (
        client.get(
            "/api/users", headers={"Authorization": "Bearer not-a-valid-token"}
        ).status_code
        == 401
    )


def test_invalid_date_range_is_rejected(client: TestClient):
    token, _ = sign_in(client)
    response = client.post(
        "/api/users",
        json=user_payload(validfrom="2027-02-01", validto="2027-01-01"),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_notes_can_be_created_listed_and_updated(client: TestClient):
    token, _ = sign_in(client)
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"title": "First note", "content": "A longer note with details."}

    created = client.post("/api/notes", json=payload, headers=headers)
    assert created.status_code == 201
    note_id = created.json()["id"]
    assert created.json()["title"] == payload["title"]
    assert created.json()["content"] == payload["content"]

    listed = client.get("/api/notes", headers=headers)
    assert listed.status_code == 200
    assert [note["id"] for note in listed.json()] == [note_id]

    updated = client.put(
        f"/api/notes/{note_id}",
        json={"title": "Updated title", "content": "Updated longer text."},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Updated title"
    assert updated.json()["content"] == "Updated longer text."


def test_notes_require_auth_and_are_private_to_their_owner(client: TestClient):
    assert client.get("/api/notes").status_code == 401
    owner_token, _ = sign_in(client)
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    created = client.post(
        "/api/notes",
        json={"title": "Private", "content": "Only the owner can see this."},
        headers=owner_headers,
    )
    note_id = created.json()["id"]

    other_user = client.post("/api/users", json=user_payload(), headers=owner_headers)
    assert other_user.status_code == 201
    requested = client.post(
        "/api/auth/request-otp", json={"identifier": "casey@example.com"}
    )
    verified = client.post(
        "/api/auth/verify-otp",
        json={
            "temporary_token": requested.json()["temporary_token"],
            "otp": "Hellothere",
        },
    )
    other_headers = {"Authorization": f"Bearer {verified.json()['token']}"}

    assert client.get("/api/notes", headers=other_headers).json() == []
    assert client.put(
        f"/api/notes/{note_id}",
        json={"title": "Stolen", "content": "Not allowed"},
        headers=other_headers,
    ).status_code == 404


def test_note_title_and_content_are_required(client: TestClient):
    token, _ = sign_in(client)
    response = client.post(
        "/api/notes",
        json={"title": "  ", "content": "Some note text"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def reset_password(client: TestClient, identifier: str, new_password: str):
    requested = client.post("/api/auth/request-otp", json={"identifier": identifier})
    assert requested.status_code == 200
    return client.post(
        "/api/auth/reset-password",
        json={
            "temporary_token": requested.json()["temporary_token"],
            "otp": "Hellothere",
            "new_password": new_password,
        },
    )


def test_password_login_fails_when_no_password_is_set(client: TestClient):
    response = client.post(
        "/api/auth/login",
        json={"identifier": "demo@example.com", "password": "anything123"},
    )
    assert response.status_code == 401


def test_password_can_be_reset_with_otp_and_used_to_sign_in(client: TestClient):
    reset = reset_password(client, "demo@example.com", "correct-horse-1")
    assert reset.status_code == 200
    assert reset.json()["user"]["username"] == "demo"
    assert "password_hash" not in reset.json()["user"]

    by_email = client.post(
        "/api/auth/login",
        json={"identifier": "DEMO@example.com", "password": "correct-horse-1"},
    )
    assert by_email.status_code == 200
    token = by_email.json()["token"]
    assert (
        client.get(
            "/api/auth/userhandler", headers={"Authorization": f"Bearer {token}"}
        ).status_code
        == 200
    )

    by_cellno = client.post(
        "/api/auth/login",
        json={"identifier": "+15550101000", "password": "correct-horse-1"},
    )
    assert by_cellno.status_code == 200


def test_wrong_password_and_unknown_user_are_rejected(client: TestClient):
    reset_password(client, "demo@example.com", "correct-horse-1")
    wrong = client.post(
        "/api/auth/login",
        json={"identifier": "demo@example.com", "password": "wrong-password"},
    )
    unknown = client.post(
        "/api/auth/login",
        json={"identifier": "nobody@example.com", "password": "correct-horse-1"},
    )
    assert wrong.status_code == 401
    assert unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"]


def test_otp_login_still_works_after_password_is_set(client: TestClient):
    reset_password(client, "demo@example.com", "correct-horse-1")
    token, user = sign_in(client)
    assert user["username"] == "demo"


def test_password_reset_requires_correct_otp_and_single_use_token(client: TestClient):
    requested = client.post(
        "/api/auth/request-otp", json={"identifier": "demo@example.com"}
    )
    payload = {
        "temporary_token": requested.json()["temporary_token"],
        "otp": "wrong",
        "new_password": "correct-horse-1",
    }
    assert client.post("/api/auth/reset-password", json=payload).status_code == 400

    payload["otp"] = "Hellothere"
    assert client.post("/api/auth/reset-password", json=payload).status_code == 200
    assert client.post("/api/auth/reset-password", json=payload).status_code == 401


def test_password_reset_rejects_short_passwords(client: TestClient):
    response = reset_password(client, "demo@example.com", "short")
    assert response.status_code == 422


def test_password_reset_signs_out_existing_sessions(client: TestClient):
    old_token, _ = sign_in(client)
    reset = reset_password(client, "demo@example.com", "new-password-1")
    new_token = reset.json()["token"]

    old = client.get(
        "/api/auth/userhandler", headers={"Authorization": f"Bearer {old_token}"}
    )
    new = client.get(
        "/api/auth/userhandler", headers={"Authorization": f"Bearer {new_token}"}
    )
    assert old.status_code == 401
    assert new.status_code == 200


def test_existing_database_is_migrated_with_password_column(tmp_path: Path):
    import sqlite3

    db_path = tmp_path / "legacy.db"
    legacy = sqlite3.connect(db_path)
    legacy.execute(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL COLLATE NOCASE UNIQUE,
            firstnames TEXT NOT NULL,
            surname TEXT NOT NULL,
            email TEXT NOT NULL COLLATE NOCASE UNIQUE,
            cellno TEXT NOT NULL UNIQUE,
            validfrom TEXT NOT NULL,
            validto TEXT NOT NULL
        )
        """
    )
    legacy.commit()
    legacy.close()

    with TestClient(create_app(db_path)) as migrated:
        assert reset_password(migrated, "demo@example.com", "migrated-pw-1").status_code == 200
