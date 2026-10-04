# TaskFlow — Task Manager Web Application

TaskFlow is a full-stack task manager built with React and Express. It provides account registration and sign-in, authenticated and user-scoped task management, status filtering, due dates, and Cloudinary-hosted task images.

## Features

- User registration and login
- Password hashing with bcryptjs
- JWT-based authentication with expiring tokens
- User-specific task isolation
- Create, read, update, and delete tasks
- Client-side status filtering: All, Pending, In Progress, and Completed
- Optional due dates
- Cloudinary image uploads with task-card previews
- Responsive React interface
- Logout that clears locally stored authentication data

## Technology stack

| Area | Technologies |
| --- | --- |
| Frontend | React, Vite, Axios, React Router |
| Backend | Node.js, Express.js, PostgreSQL (`pg`), JSON Web Tokens, bcryptjs, Multer, Cloudinary |

## Project structure

```text
.
├── backend/
│   ├── server.js
│   └── src/
│       ├── app.js
│       ├── config/          # PostgreSQL and Cloudinary configuration
│       ├── controllers/     # Authentication, task, and upload handlers
│       ├── middleware/      # JWT authentication
│       ├── routes/          # Auth, task, and upload routes
│       ├── services/        # Shared backend services, including email delivery
│       └── templates/       # HTML email templates
├── frontend/
│   ├── index.html
│   └── src/
│       ├── api/             # Axios setup and auth storage helpers
│       ├── components/      # Shared UI and task components
│       └── pages/           # Login, registration, and dashboard
├── package.json             # Workspace-level dependencies
└── README.md
```

## PostgreSQL schema

TaskFlow uses two existing tables. The application does not create or modify tables automatically; create the schema before starting the API.

### `users`

Stores each account. `password` contains a bcrypt hash, never the submitted plain-text password.

| Column | Purpose |
| --- | --- |
| `id` | `SERIAL` primary key |
| `name` | User's display name |
| `email` | User's email address |
| `password` | bcrypt password hash |
| `created_at` | Account creation timestamp |

### `tasks`

Stores tasks and associates each task with its owner.

| Column | Purpose |
| --- | --- |
| `id` | `SERIAL` primary key |
| `title` | Required task title |
| `description` | Optional task details |
| `status` | `pending`, `in_progress`, or `completed` (defaults to `pending`) |
| `due_date` | Optional `DATE` |
| `image_url` | Optional Cloudinary HTTPS URL |
| `owner_id` | Required foreign key to `users.id` |

The relationship is one-to-many: a user can own many tasks. The task foreign key uses `ON DELETE CASCADE`, so deleting a user removes that user's tasks.

## API documentation

The API is mounted under `/api`. Protected endpoints require this header:

```http
Authorization: Bearer <JWT>
```

JSON endpoints use `Content-Type: application/json`. Error responses contain a `message`; database/provider internals are not returned.

### `POST /api/auth/register`

- **Purpose:** Register a user.
- **Authentication:** Not required.
- **Request:**

```json
{
  "name": "Example User",
  "email": "person@example.com",
  "password": "<password>"
}
```

- **Success (`201`):**

```json
{
  "message": "Registration successful",
  "user": {
    "id": 12,
    "name": "Example User",
    "email": "person@example.com"
  }
}
```

The password must be at least six characters. Invalid fields return `400`; an existing email returns `409`. The response never includes a password or hash.

### `POST /api/auth/login`

- **Purpose:** Validate credentials and issue a signed JWT.
- **Authentication:** Not required.
- **Request:**

```json
{
  "email": "person@example.com",
  "password": "<password>"
}
```

- **Success (`200`):**

```json
{
  "token": "<signed-jwt>",
  "user": {
    "id": 12,
    "name": "Example User",
    "email": "person@example.com"
  }
}
```

Invalid credentials return `401`. The token expiration is configured with `JWT_EXPIRES_IN` (defaults to one day).

### `GET /api/tasks`

- **Purpose:** List the authenticated user's tasks.
- **Authentication:** Required.
- **Success (`200`):** An array of task objects; an account with no tasks receives `[]`. Results are scoped to the authenticated user.

```json
[
  {
    "id": 31,
    "title": "Prepare project review",
    "description": "Collect the latest updates",
    "status": "pending",
    "due_date": "2026-11-15",
    "image_url": null,
    "owner_id": 12
  }
]
```

### `POST /api/tasks`

- **Purpose:** Create a task for the authenticated user.
- **Authentication:** Required.
- **Request:** `title` and `status` are required. `description`, `due_date`, and `image_url` are optional. The server sets `owner_id` from the JWT; clients cannot assign it.

```json
{
  "title": "Prepare project review",
  "description": "Collect the latest updates",
  "status": "pending",
  "due_date": "2026-11-15",
  "image_url": "https://res.cloudinary.com/<cloud>/image/upload/<asset>"
}
```

- **Success (`201`):** Returns the created task object, including its `id` and `owner_id`. Invalid input returns `400`.

### `GET /api/tasks/:id`

- **Purpose:** Get one task owned by the authenticated user.
- **Authentication:** Required.
- **Success (`200`):** Returns the task object. Missing tasks and tasks owned by another user both return `404`.

### `PUT /api/tasks/:id`

- **Purpose:** Update a task owned by the authenticated user.
- **Authentication:** Required.
- **Request:** `title` and `status` are required by the current validator. Editable fields are `title`, `description`, `status`, `due_date`, and `image_url`; `owner_id` cannot be changed.

```json
{
  "title": "Prepare project review",
  "description": "Add final metrics",
  "status": "in_progress",
  "due_date": "2026-11-17",
  "image_url": null
}
```

- **Success (`200`):** Returns the updated task object. Invalid input returns `400`; missing/other-owner tasks return `404`.

### `DELETE /api/tasks/:id`

- **Purpose:** Delete a task owned by the authenticated user.
- **Authentication:** Required.
- **Success (`200`):**

```json
{
  "message": "Task deleted successfully"
}
```

Missing tasks and tasks owned by another user return `404`.

### `POST /api/upload`

- **Purpose:** Upload a task image to Cloudinary and return its HTTPS URL.
- **Authentication:** Required.
- **Request:** `multipart/form-data` with one file in the `image` field. Supported types are JPG/JPEG, PNG, and WebP; maximum size is 5 MB.
- **Success (`201`):**

```json
{
  "message": "Image uploaded successfully",
  "imageUrl": "https://res.cloudinary.com/<cloud>/image/upload/<asset>"
}
```

The endpoint keeps the file in memory while forwarding it to Cloudinary; it does not permanently store the upload on the application server. The frontend saves the returned URL in the task's `image_url` field.

### `GET /api/reminders/due-date`

- **Purpose:** Process reminders for tasks due the next calendar day. This endpoint is intended for the configured Vercel Cron, not for end-user requests.
- **Authentication:** Required. Send `Authorization: Bearer <CRON_SECRET>`.
- **Success (`200`):** Returns counts of sent, skipped (already claimed), and failed reminders. Email failures are logged and do not stop other reminders from being processed.
- **Schedule:** Vercel calls this endpoint daily at 09:00 UTC. Since task due dates are date-only, reminders are sent on the calendar day before the due date.

## Environment variables

Configure these variable names in the appropriate environment. Do not commit secret values.

| Variable name | Used by |
| --- | --- |
| `PORT` | Backend listening port (defaults to `5000`) |
| `DATABASE_URL` | Backend PostgreSQL connection string |
| `FRONTEND_URL` | Frontend base URL used for the welcome email dashboard link |
| `JWT_SECRET` | Backend JWT signing and verification |
| `JWT_EXPIRES_IN` | Backend token lifetime (defaults to `1d`) |
| `CLOUDINARY_CLOUD_NAME` | Backend Cloudinary SDK configuration |
| `CLOUDINARY_API_KEY` | Backend Cloudinary SDK configuration |
| `CLOUDINARY_API_SECRET` | Backend Cloudinary SDK configuration |
| `SMTP_HOST` | SMTP server hostname for welcome emails |
| `SMTP_PORT` | SMTP server port; port `465` uses a secure connection |
| `SMTP_USER` | SMTP authentication username |
| `SMTP_PASS` | SMTP authentication password |
| `SMTP_FROM` | Sender address displayed on emails |
| `CRON_SECRET` | Long random bearer token that authorizes scheduled reminder requests |
| `VITE_API_URL` | Frontend API origin; defaults to `http://localhost:5000` |

Keep Cloudinary credentials, SMTP credentials, `CRON_SECRET`, and `JWT_SECRET` on the server only. Do not use a `VITE_` prefix for secrets; Vite variables are bundled into client-accessible code. Copy `backend/.env.example` to `backend/.env` and replace its safe placeholders with local configuration values. Welcome email delivery is best-effort: an SMTP failure is logged and does not undo a successful registration.

## Local setup

### Prerequisites

- Node.js and npm
- PostgreSQL with the `users` and `tasks` tables described above
- A Cloudinary account for image uploads

### Install dependencies

Run these commands from the repository root:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

The root install includes workspace-level dependencies such as the Cloudinary SDK. The backend and frontend have their own package manifests and lockfiles.

### Configure environment

Create `backend/.env` and provide the backend variable names listed above. For local development, set the frontend CORS origin to the Vite origin. Optionally create `frontend/.env.local` and set `VITE_API_URL` to the backend origin; the frontend defaults to `http://localhost:5000`.

### Run the backend

```bash
npm --prefix backend start
```

The API listens on port `5000` by default.

### Run the frontend

In another terminal:

```bash
npm --prefix frontend run dev
```

Open the local Vite URL shown in the terminal (typically `http://localhost:5173`).

### Frontend checks

```bash
npm --prefix frontend run build
npm --prefix frontend run lint
```

The backend currently has no automated test suite configured; use the API documentation and testing checklist below for manual verification.

## Cloudinary image upload flow

1. A signed-in user selects a supported image in the task form.
2. The frontend checks the file type and size, then sends it as `multipart/form-data` under `image` to `POST /api/upload` with the JWT bearer header.
3. Multer holds the file in memory with a 5 MB limit. The server validates the file and streams it to Cloudinary using server-side credentials.
4. The backend returns a secure HTTPS `imageUrl`.
5. The frontend uses that URL as `image_url` when creating or updating the task. The task row stores the URL, not the image file.

## Deployment with Vercel

### Frontend

1. Import the repository into Vercel and set the project root to `frontend/`.
2. Use the Vite build command `npm run build` and output directory `dist`.
3. Set `VITE_API_URL` in Vercel's project environment settings to the deployed backend's origin (without an `/api` suffix).
4. Confirm the backend CORS configuration allows the deployed frontend origin.

### Backend and services

The backend is available as an Express app through `backend/api/index.js` for Vercel Functions, and can also be started locally with `node server.js`. Configure `DATABASE_URL`, JWT variables, Cloudinary variables, `FRONTEND_URL`, and the SMTP variables in the backend host's environment settings. Never put backend secrets in Vercel frontend variables or source control.

Due-date reminders use the Vercel Cron configured in `backend/vercel.json`, which calls `GET /api/reminders/due-date` daily at 09:00 UTC. Vercel supplies `CRON_SECRET` as a bearer token; set the same long random secret in the backend's environment. Before deploying, apply the `due_date_reminders` table definition from `backend/db/schema.sql` to the existing PostgreSQL database. The job selects tasks due the next calendar day, only when their owner exists, and records a unique task claim to prevent repeat sends. Failed email sends are logged and their claim is released so a later run can retry.

Use a managed PostgreSQL database reachable by the deployed backend. Configure the production frontend origin for CORS, verify database network access, and test login, task ownership, image upload, and the scheduled reminder endpoint after deployment.

## Testing checklist

- [ ] Register with valid details; confirm the response contains no password.
- [ ] Reject missing registration fields, malformed email, short password, and duplicate email.
- [ ] Log in with valid credentials; confirm a signed token is returned and invalid credentials receive `401`.
- [ ] Confirm protected task and upload endpoints reject missing, invalid, and expired tokens.
- [ ] Create, list, read, update, and delete tasks; confirm task data is isolated by user.
- [ ] Verify task status filtering changes the displayed list without another list request.
- [ ] Check due dates and valid task status values.
- [ ] Upload JPG/JPEG, PNG, and WebP images; confirm unsupported formats and files over 5 MB are rejected.
- [ ] Confirm successful upload returns an HTTPS URL and the task stores that URL.
- [ ] Edit an image task without selecting a replacement; confirm its image URL is retained.
- [ ] Verify task cards, images, modal dialogs, and actions at desktop and mobile viewport sizes.
- [ ] Log out and confirm protected dashboard access redirects to login.
- [ ] Run the frontend build and lint commands before submission.

## Future improvements

- Automated backend unit and integration tests
- Pagination, search, and sorting for larger task lists
- Refresh-token or server-side session strategy and stronger rate limiting
- Password reset and email verification
- Improved request validation and centralized API error handling
- Task collaboration, reminders, and calendar integrations
- Image deletion/cleanup when task images are replaced or tasks are removed
- CI checks and deployment automation
