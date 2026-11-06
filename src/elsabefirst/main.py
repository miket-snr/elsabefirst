import hashlib
import os
import secrets
import sqlite3
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from elsabefirst.database import connection_for, initialize_database
from elsabefirst.passwords import DUMMY_HASH, hash_password, verify_password
from elsabefirst.schemas import (
    AuthenticatedUser,
    LoginRequest,
    Note,
    NoteCreate,
    NoteUpdate,
    OtpRequested,
    OtpVerification,
    PasswordLogin,
    PasswordReset,
    User,
    UserCreate,
    UserUpdate,
)


DEVELOPMENT_OTP = "Hellothere"
TEMPORARY_TOKEN_MINUTES = 5
ACCESS_TOKEN_DAYS = 30
bearer_scheme = HTTPBearer(auto_error=False)


def utc_now() -> datetime:
    return datetime.now(UTC)


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def token_expiration(token_type: str) -> datetime:
    duration = (
        timedelta(minutes=TEMPORARY_TOKEN_MINUTES)
        if token_type == "temporary"
        else timedelta(days=ACCESS_TOKEN_DAYS)
    )
    return utc_now() + duration


def row_to_user(row: sqlite3.Row) -> User:
    return User.model_validate(dict(row))


def create_app(database: Path | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        initialize_database(database)
        yield

    application = FastAPI(
        title="Elsabefirst API",
        version="0.1.0",
        lifespan=lifespan,
    )
    cors_origins = os.environ.get(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    )
    cors_origin_regex = os.environ.get(
        "CORS_ORIGIN_REGEX", r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in cors_origins.split(",") if origin.strip()],
        allow_origin_regex=cors_origin_regex or None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def get_db():
        with connection_for(database) as connection:
            yield connection

    Db = Annotated[sqlite3.Connection, Depends(get_db)]

    def current_user(
        db: Db,
        credentials: Annotated[
            HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
        ],
    ) -> User:
        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="A bearer token is required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        now = utc_now().isoformat()
        row = db.execute(
            """
            SELECT users.*
            FROM tokens
            JOIN users ON users.id = tokens.user_id
            WHERE tokens.token_hash = ?
              AND tokens.token_type = 'access'
              AND tokens.revoked_at IS NULL
              AND tokens.expires_at > ?
            """,
            (token_digest(credentials.credentials), now),
        ).fetchone()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is invalid or expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return row_to_user(row)

    CurrentUser = Annotated[User, Depends(current_user)]

    @application.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        return {
            "message": "Elsabefirst API is running",
            "docs": "/docs",
            "health": "/api/health",
        }

    @application.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @application.post("/api/auth/request-otp", response_model=OtpRequested)
    def request_otp(payload: LoginRequest, db: Db) -> OtpRequested:
        row = find_user_by_identifier(db, payload.identifier)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No user was found with that email address or mobile number",
            )

        temporary_token = secrets.token_urlsafe(32)
        created_at = utc_now()
        db.execute(
            """
            INSERT INTO tokens (token_hash, user_id, token_type, expires_at, created_at)
            VALUES (?, ?, 'temporary', ?, ?)
            """,
            (
                token_digest(temporary_token),
                row["id"],
                token_expiration("temporary").isoformat(),
                created_at.isoformat(),
            ),
        )
        db.commit()
        return OtpRequested(
            temporary_token=temporary_token,
            message="Temporary token created. Enter the OTP to complete sign-in.",
        )

    def find_user_by_identifier(db: sqlite3.Connection, identifier: str):
        identifier = identifier.strip()
        return db.execute(
            """
            SELECT * FROM users
            WHERE email = ? COLLATE NOCASE OR cellno = ?
            """,
            (identifier.lower(), identifier),
        ).fetchone()

    def consume_temporary_token(
        db: sqlite3.Connection, temporary_token: str, otp: str, now: datetime
    ) -> int:
        """Validate the OTP challenge, mark it used, and return its user id.

        Starts a write transaction that the caller must commit.
        """
        if otp != DEVELOPMENT_OTP:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The OTP is incorrect",
            )
        db.execute("BEGIN IMMEDIATE")
        temporary = db.execute(
            """
            SELECT * FROM tokens
            WHERE token_hash = ?
              AND token_type = 'temporary'
              AND revoked_at IS NULL
              AND expires_at > ?
            """,
            (token_digest(temporary_token), now.isoformat()),
        ).fetchone()
        if temporary is None:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Temporary token is invalid, expired, or already used",
            )
        db.execute(
            "UPDATE tokens SET revoked_at = ? WHERE token_hash = ?",
            (now.isoformat(), temporary["token_hash"]),
        )
        return temporary["user_id"]

    def issue_access_token(
        db: sqlite3.Connection, user_id: int, now: datetime
    ) -> str:
        access_token = secrets.token_urlsafe(48)
        db.execute(
            """
            INSERT INTO tokens (token_hash, user_id, token_type, expires_at, created_at)
            VALUES (?, ?, 'access', ?, ?)
            """,
            (
                token_digest(access_token),
                user_id,
                token_expiration("access").isoformat(),
                now.isoformat(),
            ),
        )
        return access_token

    def authenticated_response(
        db: sqlite3.Connection, user_id: int, access_token: str
    ) -> AuthenticatedUser:
        user_row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if user_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User no longer exists",
            )
        return AuthenticatedUser(token=access_token, user=row_to_user(user_row))

    @application.post("/api/auth/verify-otp", response_model=AuthenticatedUser)
    def verify_otp(payload: OtpVerification, db: Db) -> AuthenticatedUser:
        now = utc_now()
        user_id = consume_temporary_token(db, payload.temporary_token, payload.otp, now)
        access_token = issue_access_token(db, user_id, now)
        db.commit()
        return authenticated_response(db, user_id, access_token)

    @application.post("/api/auth/login", response_model=AuthenticatedUser)
    def login_with_password(payload: PasswordLogin, db: Db) -> AuthenticatedUser:
        row = find_user_by_identifier(db, payload.identifier)
        stored_hash = row["password_hash"] if row is not None else None
        # Always run a hash check so timing doesn't reveal whether the account
        # exists or has a password set.
        valid = verify_password(payload.password, stored_hash or DUMMY_HASH)
        if row is None or stored_hash is None or not valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="The email/mobile number or password is incorrect",
            )
        now = utc_now()
        access_token = issue_access_token(db, row["id"], now)
        db.commit()
        return authenticated_response(db, row["id"], access_token)

    @application.post("/api/auth/reset-password", response_model=AuthenticatedUser)
    def reset_password(payload: PasswordReset, db: Db) -> AuthenticatedUser:
        """Set a new password after proving identity with an OTP challenge.

        Also used to set a password for the first time. Existing sessions are
        signed out and a fresh access token is returned.
        """
        now = utc_now()
        user_id = consume_temporary_token(db, payload.temporary_token, payload.otp, now)
        db.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(payload.new_password), user_id),
        )
        db.execute(
            """
            UPDATE tokens SET revoked_at = ?
            WHERE user_id = ? AND token_type = 'access' AND revoked_at IS NULL
            """,
            (now.isoformat(), user_id),
        )
        access_token = issue_access_token(db, user_id, now)
        db.commit()
        return authenticated_response(db, user_id, access_token)

    @application.get("/api/auth/userhandler", response_model=User)
    def userhandler(user: CurrentUser) -> User:
        return user

    @application.get("/api/users", response_model=list[User])
    def list_users(_: CurrentUser, db: Db) -> list[User]:
        rows = db.execute("SELECT * FROM users ORDER BY surname, firstnames").fetchall()
        return [row_to_user(row) for row in rows]

    @application.post(
        "/api/users",
        response_model=User,
        status_code=status.HTTP_201_CREATED,
    )
    def create_user(payload: UserCreate, _: CurrentUser, db: Db) -> User:
        try:
            cursor = db.execute(
                """
                INSERT INTO users
                    (username, firstnames, surname, email, cellno, validfrom, validto)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload.username,
                    payload.firstnames,
                    payload.surname,
                    payload.email,
                    payload.cellno,
                    payload.validfrom.isoformat(),
                    payload.validto.isoformat(),
                ),
            )
            db.commit()
        except sqlite3.IntegrityError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username, email, or mobile number is already in use",
            ) from error
        row = db.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
        if row is None:
            raise HTTPException(status_code=500, detail="Created user could not be loaded")
        return row_to_user(row)

    @application.put("/api/users/{user_id}", response_model=User)
    def update_user(
        user_id: int,
        payload: UserUpdate,
        _: CurrentUser,
        db: Db,
    ) -> User:
        try:
            cursor = db.execute(
                """
                UPDATE users
                SET username = ?, firstnames = ?, surname = ?, email = ?,
                    cellno = ?, validfrom = ?, validto = ?
                WHERE id = ?
                """,
                (
                    payload.username,
                    payload.firstnames,
                    payload.surname,
                    payload.email,
                    payload.cellno,
                    payload.validfrom.isoformat(),
                    payload.validto.isoformat(),
                    user_id,
                ),
            )
            db.commit()
        except sqlite3.IntegrityError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username, email, or mobile number is already in use",
            ) from error
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="User was not found")
        row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="User was not found")
        return row_to_user(row)

    @application.get("/api/notes", response_model=list[Note])
    def list_notes(user: CurrentUser, db: Db) -> list[Note]:
        rows = db.execute(
            """
            SELECT id, title, content, created_at, updated_at
            FROM notes
            WHERE user_id = ?
            ORDER BY updated_at DESC, id DESC
            """,
            (user.id,),
        ).fetchall()
        return [Note.model_validate(dict(row)) for row in rows]

    @application.post(
        "/api/notes",
        response_model=Note,
        status_code=status.HTTP_201_CREATED,
    )
    def create_note(payload: NoteCreate, user: CurrentUser, db: Db) -> Note:
        now = utc_now().isoformat()
        cursor = db.execute(
            """
            INSERT INTO notes (user_id, title, content, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user.id, payload.title, payload.content, now, now),
        )
        db.commit()
        row = db.execute(
            """
            SELECT id, title, content, created_at, updated_at
            FROM notes WHERE id = ? AND user_id = ?
            """,
            (cursor.lastrowid, user.id),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=500, detail="Created note could not be loaded")
        return Note.model_validate(dict(row))

    @application.put("/api/notes/{note_id}", response_model=Note)
    def update_note(
        note_id: int,
        payload: NoteUpdate,
        user: CurrentUser,
        db: Db,
    ) -> Note:
        updated_at = utc_now().isoformat()
        cursor = db.execute(
            """
            UPDATE notes
            SET title = ?, content = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (payload.title, payload.content, updated_at, note_id, user.id),
        )
        db.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Note was not found")
        row = db.execute(
            """
            SELECT id, title, content, created_at, updated_at
            FROM notes WHERE id = ? AND user_id = ?
            """,
            (note_id, user.id),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Note was not found")
        return Note.model_validate(dict(row))

    @application.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
    def logout(
        credentials: Annotated[
            HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
        ],
        db: Db,
    ) -> Response:
        if credentials is None:
            raise HTTPException(status_code=401, detail="A bearer token is required")
        db.execute(
            """
            UPDATE tokens SET revoked_at = ?
            WHERE token_hash = ? AND token_type = 'access' AND revoked_at IS NULL
            """,
            (utc_now().isoformat(), token_digest(credentials.credentials)),
        )
        db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return application


app = create_app()
