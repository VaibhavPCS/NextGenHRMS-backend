# NextGenHRMS Backend Documentation

This document provides a comprehensive guide to the API endpoints and internal functions of the NextGenHRMS backend. It is intended for future developers to understand the system architecture and extend the functionality.

## Table of Contents
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
  - [Health Check](#health-check)
  - [HR Module](#hr-module)
  - [Candidate Module](#candidate-module)
- [Services & Functions](#services--functions)
- [Security & Validation](#security--validation)

---

## Project Structure

```
backend/
├── src/
│   ├── config/          # Database and SuperTokens configuration
│   ├── controllers/     # Request handlers
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic
│   └── utils/           # Utility functions (encryption, logging, etc.)
├── prisma/              # Prisma schema and migrations
├── index.js             # Application entry point
└── package.json         # Dependencies and scripts
```

---

## API Endpoints

### Health Check

**Endpoint:** `GET /api/health`

Checks if the backend server is running.

- **Response:**
  ```json
  {
    "status": "NextGenHRMS Engine is Online"
  }
  ```

---

### HR Module

#### Invite Candidate

**Endpoint:** `POST /api/hr/invite`

Invites a new candidate by generating a unique token and sending an invite link.

- **Controller:** `src/controllers/hr.controller.js` -> `inviteCandidate`
- **Service:** `src/services/hr.service.js` -> `stageCandidate`

- **Request Body:**
  ```json
  {
    "personalEmail": "candidate@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+919876543210"
  }
  ```

- **Validations:**
  - `personalEmail`: Must be a valid email format.
  - `phoneNumber`: Must be a valid Indian mobile number (+91 format).
  - Domain Check: Email domain must be in the allowed list (`ALLOWED_EMAIL_DOMAINS` env var).

- **Responses:**
  - `200 OK`: Invite sent successfully.
  - `400 Bad Request`: Invalid email/phone format.
  - `403 Forbidden`: Email domain not allowed.
  - `409 Conflict`: Candidate with this email/phone already exists.

---

### Candidate Module

#### Submit Details

**Endpoint:** `POST /api/candidate/submit-details`

Allows a candidate to submit their personal details and upload documents.

- **Controller:** `src/controllers/candidate.controller.js` -> `submitCandidateDetails`
- **Service:** `src/services/candidate.service.js` -> `submitCandidateDetails`
- **Middleware:** `uploadMiddleware` (Multer)

- **Request Body (Multipart/Form-Data):**
  - **Fields:**
    - `inviteToken` (Required): Token from the invite link.
    - `emergencyContact`: Emergency phone number.
    - `bloodGroup`: Blood group (e.g., "O+").
    - `aadharNumber`: 12-digit Aadhar number.
    - `panNumber`: PAN card number.
  - **Files:**
    - `aadharFile` (Max 1)
    - `panFile` (Max 1)
    - `profilePhoto` (Max 1)
    - `tenthMarksheet` (Max 1)
    - `twelfthMarksheet` (Max 1)
    - `collegecertificate` (Multiple allowed)
    - `skilledcertificate` (Multiple allowed)
    - `passport` (Max 1)

- **Validations:**
  - **File Limits:** Max 5MB per file.
  - **Aadhar Format:** Exactly 12 digits.
  - **PAN Format:** `ABCDE1234F` pattern.
  - **Duplicate Check:** Checks for duplicate file uploads (using SHA-256 hash).
  - **Identity Check:** Checks if Aadhar or PAN is already registered.

- **Responses:**
  - `200 OK`: Documents uploaded successfully.
  - `400 Bad Request`: File limit exceeded, duplicate files, or invalid input.
  - `409 Conflict`: Duplicate Government ID (Aadhar/PAN).

---

## Services & Functions

### HR Service (`src/services/hr.service.js`)

- **`stageCandidate(personalEmail, firstName, lastName, phoneNumber)`**
  - Creates a new `OnboardingCandidate` record in the database.
  - Generates a random 32-byte hex token (`inviteToken`).
  - Sets an expiry time based on `INVITE_EXPIRY_HOURS`.
  - **Returns:** The generated invite token.

### Candidate Service (`src/services/candidate.service.js`)

- **`submitCandidateDetails(...)`**
  - **Parameters:** Token, personal details, file URLs.
  - **Logic:**
    1.  **Token Verification:** Checks if the token exists and is not expired.
    2.  **Blind Indexing:** Generates hashes for Aadhar and PAN to check for duplicates without exposing raw data.
    3.  **Duplicate Check:** Queries the database for existing `aadharHash` or `panHash`.
    4.  **Encryption:** Encrypts Aadhar and PAN numbers using `encryptPII`.
    5.  **Update:** Updates the candidate record with encrypted data, file URLs, and sets status to `DOCS_UPLOADED`.
    6.  **Cleanup:** Clears the `inviteToken` to prevent reuse.
  - **Returns:** The updated candidate object.

### Utility Functions

- **`src/utils/encryption.js`**
  - `encryptPII(text)`: Encrypts sensitive Personal Identifiable Information.
  - `generateBlindIndex(text)`: Generates a deterministic hash for searching encrypted fields.

- **`src/controllers/candidate.controller.js`**
  - `generateFileHash(filePath)`: Reads a file and returns its SHA-256 hash to detect duplicate uploads.

- **`src/utils/logger.js`**
  - Implements `pino` logger with rotating file transports (`pino-roll`).
  - **Logs Directory:** `./logs/combined.log` (All logs) and `./logs/error.log` (Errors only).
  - **Features:**
    - **Rotation:** Files rotate daily or when size exceeds 10MB.
    - **Redaction:** Sensitive PII (Aadhar, PAN, Passwords, Tokens) is automatically redacted from logs.
    - **Development Mode:** Pretty-prints logs to the console using `pino-pretty`.

---

## Security & Validation

1.  **PII Protection:** Sensitive data like Aadhar and PAN numbers are never stored in plain text. They are encrypted before storage.
2.  **Blind Indexing:** To allow uniqueness checks on encrypted data, a deterministic hash (blind index) is stored.
    - *Note:* Unique constraints on `aadharHash` and `panHash` are handled at the application level to allow for initial `null` values.
3.  **File Validation:**
    - Size limit: 5MB.
    - Duplicate file detection prevents users from uploading the same file for different documents.
4.  **Token-Based Access:** Candidate submission requires a valid, non-expired invite token.
5.  **Domain Restriction:** HR invites are restricted to specific email domains to prevent unauthorized access.
