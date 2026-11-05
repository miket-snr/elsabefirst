# React, Tailwind CSS, and FastAPI Application Plan

## Current project and implementation status

The repository started as a small Python package. The FastAPI backend and
separate React frontend are now implemented under the existing project.

## Proposed implementation

### 1. Establish the application structure

- Add a FastAPI application to the Python project and organize API, database,
  model, schema, and configuration code into focused modules.
- Add a React frontend using Vite and Tailwind CSS in a dedicated frontend
  directory.
- Configure local development so the frontend can call the API, including
  appropriate API base URL configuration and CORS settings.

### 2. Add persistence and user management

- Configure a relational database and create `users` and `tokens` tables.
- Store the requested user fields: username, firstnames, surname, email,
  cellno, validfrom, and validto.
- Add API operations to list, create, update, and retrieve users, with
  validation for required fields and date values.
- Keep authentication tokens in the token table and associate them with users.

### 3. Implement sign-in and token validation

- On application startup, check local storage for `testtoken`.
- If present, call the API's user-handler validation operation with that token.
  Treat the token as valid only when the API returns user details; otherwise,
  clear the invalid token and show the login page.
- If no valid token exists, allow the user to enter an email address or mobile
  number to request a temporary token.
- Accept the temporary token and the current development OTP, `Hellothere`,
  through an API verification operation. On success, return user details and a
  newly issued token, then save that token as `testtoken`.
- Keep OTP delivery out of scope for this first version so SMS or email
  delivery can be integrated later.

### 4. Build the React user interface

- Create a landing page with a collapsible sidebar, navigation options for the
  welcome area and user management, and a main content area.
- Protect authenticated pages behind the startup token check.
- Create a users list with an action to add a user and edit an existing user by
  double-clicking its row.
- Provide a form for all requested user fields and connect it to the create and
  update API operations.
- Add a Notes page where the signed-in user can create notes with a short title
  and longer text, select a note from a list, and edit/save it.
- Include loading, validation, and API error states for authentication and user
  management.

### 5. Verify and document operation

- [x] Add backend tests for user operations, temporary-token/OTP verification, and
  token validation.
- [x] Add frontend build/type checks for authentication routing and the user list
  create/edit flows, using the test tooling appropriate to the chosen setup.
- [x] Run the relevant tests and build/type checks.
- [x] Document setup commands, configuration, and how to run both applications in
  the project README.

## Implementation notes

- SQLite uses the Python standard library. The users and tokens tables are
  initialized automatically; an empty database receives a demo user so the
  initial sign-in flow is testable.
- Tokens are stored as SHA-256 digests rather than as plaintext. Temporary
  tokens are short-lived and single-use; access tokens can be revoked at
  logout.
- The frontend stores access tokens under `testtoken` and validates them through
  `/api/auth/userhandler` before showing the workspace.
- The fixed OTP and demo account are development conveniences only. Replace
  them before deploying in a production environment.
- Notes are stored in SQLite and scoped to their authenticated owner.
- Verified the browser sign-in flow, sidebar/user directory navigation, and
  double-click edit dialog against a locally running API.

## Acceptance criteria

- A stored valid `testtoken` opens the authenticated landing page; a missing or
  invalid token routes to login.
- Login accepts either email or mobile number, issues a temporary token, and
  requires `Hellothere` to complete sign-in.
- Successful OTP verification returns user details and a new token, which is
  stored as `testtoken`.
- The sidebar can collapse and provides access to user management.
- Users can be listed, created, and edited by double-clicking a user.
- Users can create and edit their own notes from a clickable notes list.
- User records include username, firstnames, surname, email, cellno, validfrom,
  and validto.
- The backend is the source of truth for users and valid tokens.

## Assumptions to confirm during implementation

- [x] Use SQLite for the initial database unless a different database is requested.
- [x] Treat `Hellothere` as a development-only fixed OTP; do not present it as a
  production authentication mechanism.
- [x] Use the existing Python project as the backend project and keep the React app
  in its own frontend directory.
