# Elsabefirst

A people-management workspace with a React, TypeScript, and Tailwind CSS
frontend and a FastAPI/SQLite backend.

## Requirements

- Python 3.15 or newer and [uv](https://docs.astral.sh/uv/)
- Node.js 20 or newer and npm

## Start the API

From the repository root:

```powershell
uv sync --extra test
uv run uvicorn elsabefirst.main:app --reload
```

The API is available at `http://127.0.0.1:8000`. Interactive API documentation
is at `http://127.0.0.1:8000/docs`. The SQLite database is created as
`elsabefirst.db`; set `DATABASE_PATH` to use a different file.

If Uvicorn reports a Windows socket error while binding to port 8000, another
process may already be using that port. Use an available port instead, for
example:

```powershell
uv run uvicorn elsabefirst.main:app --reload --host 127.0.0.1 --port 8765
```

Then start the frontend with its API URL pointed at that port:

```powershell
cd frontend
$env:VITE_API_URL = "http://127.0.0.1:8765"
npm run dev
```

On an empty database, the API creates a demo user:

- Email: `demo@example.com`
- Mobile: `+15550101000`
- Development OTP: `Hellothere`

The OTP is fixed for development only. Replace it with a real delivery and
verification mechanism before production use. Configure allowed browser origins
with comma-separated `CORS_ORIGINS`; by default the Vite localhost origins are
allowed, including localhost and `127.0.0.1` on Vite's fallback ports. Set
`CORS_ORIGIN_REGEX` to change the localhost-origin pattern, or set it to an
empty string to disable the pattern and use only `CORS_ORIGINS`.

## Start the frontend

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (normally `http://127.0.0.1:5173`). The frontend calls
`http://127.0.0.1:8000` by default. To change it, copy `frontend/.env.example`
to `frontend/.env` and set `VITE_API_URL`.

The app validates `testtoken` against `GET /api/auth/userhandler` on startup.
The user directory supports adding users and editing an existing user by
double-clicking its row.
The Notes page lets signed-in users create and edit their own titled notes.

## Tests and production build

```powershell
uv run pytest
cd frontend
npm run build
```

## API outline

- `POST /api/auth/request-otp` — accepts an email or mobile number and returns a
  short-lived temporary token.
- `POST /api/auth/verify-otp` — accepts that temporary token and OTP, then
  returns user details and an access token.
- `GET /api/auth/userhandler` — validates a bearer access token and returns the
  associated user.
- `GET /api/users`, `POST /api/users`, and `PUT /api/users/{user_id}` — list,
  create, and update users; all require a valid bearer token.
- `GET /api/notes`, `POST /api/notes`, and `PUT /api/notes/{note_id}` — list,
  create, and update notes belonging to the authenticated user.
- `POST /api/auth/logout` — revokes the current access token.

Access tokens are stored as SHA-256 digests in the tokens table. Temporary
tokens expire after five minutes and are single-use; access tokens expire after
30 days. User records contain username, firstnames, surname, email, cellno,
validfrom, and validto.