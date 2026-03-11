# NextGenHRMS Backend Documentation

This document provides a comprehensive guide to the API endpoints and internal functions of the NextGenHRMS backend. It is intended for future developers to understand the system architecture and extend the functionality.

## Table of Contents
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
  - [Health Check](#health-check)
  - [HR Module](#hr-module)
  - [Candidate Module](#candidate-module)
- [Services & Functions](#services--functions)
- [Testing](#testing)
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

### Employee Module

#### Get Current Employee Profile

**Endpoint:** `GET /api/employee/me`

Fetches the profile of the currently logged-in employee, including their role and calculated permissions.

- **Controller:** `src/controllers/employee.controller.js` -> `getMe`
- **Service:** `src/services/employee.service.js` -> `getEmployeeProfile`
- **Middleware:** `verifySession` (SuperTokens)

- **Response Body:**
  ```json
  {
    "id": "65e...",
    "firstName": "Vaibhav",
    "lastName": "Sharma",
    "designation": "Software Engineer",
    "email": "vaibhav@example.com",
    "role": "HR Admin",
    "permissions": ["DASHBOARD_VIEW", "EMPLOYEE_VIEW", "LEAVE_APPROVE"]
  }
  ```

- **Logic:**
  1.  **Authentication:** Validates the session cookie.
  2.  **Fetch Profile:** Queries the database using the `supertokensId` from the session.
  3.  **Permission Calculation:** Merges Role Permissions + Granted Permissions - Revoked Permissions.
  4.  **Active Check:** Returns 403 if `isActive` is false.

- **Responses:**
  - `200 OK`: Profile retrieved successfully.
  - `403 Forbidden`: Access revoked or not an active employee.
  - `404 Not Found`: Employee record not found.

---

### Employee Management Module

#### Link User to Employee

**Endpoint:** `POST /api/auth/link-employee`

Links a SuperTokens authenticated user (via OTP) to an existing Employee record in the database.

- **Controller:** `src/controllers/auth.controller.js` -> `linkUserToEmployeeController`
- **Service:** `src/services/auth.service.js` -> `linkUserToEmployee`

- **Logic:**
  1.  **Extract Phone Number:** Retrieves the verified phone number directly from the SuperTokens session.
  2.  **Find Employee:** Searches the `Employee` table for a matching phone number.
  3.  **Active Check:** Verifies that `isActive` is `true`. Terminated employees are blocked immediately.
  4.  **Link ID:** Updates the `Employee` record with the `supertokensId` to bind the auth session to the business data.

- **Responses:**
  - `200 OK`: Link successful, returns employee details.
  - `403 Forbidden`: User is not a registered employee OR access has been revoked (`isActive: false`).
  - `500 Internal Server Error`: Database or SuperTokens error.

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

### Employee Service (`src/services/employee.service.js`)

- **`getEmployeeProfile(supertokensId)`**
  - **Logic:** Fetches employee + role + permissions in a single query.
  - **Calculations:** Computes effective permissions by applying per-user overrides (granted/revoked) on top of role-based permissions.
  - **Security:** Checks `isActive` status before returning data.

### Auth Service (`src/services/auth.service.js`)

- **`linkUserToEmployee(supertokensId)`**
  - **Security:** automatically deletes the SuperTokens user if no matching Employee is found or if the Employee is inactive. This prevents unauthorized users from maintaining a valid session.
  - **Idempotency:** Checks if the `supertokensId` is already linked to avoid unnecessary database writes.

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

## Testing

The backend includes unit tests for core services (Auth, Employee, HR) to ensure reliability.

### Running Tests

To run the test suite:

```bash
npm test
```

To run tests in watch mode during development:

```bash
npm run test:watch
```

### Test Structure

-   **Location:** `src/__tests__/`
-   **Framework:** Jest
-   **Coverage:**
    -   **Auth Service:** Tests user linking, duplicate checks, and error handling.
    -   **Employee Service:** Tests profile fetching, permission calculation, and active status checks.
    -   **HR Service:** Tests candidate staging logic.
-   **Methodology:** Dependencies like Prisma, SuperTokens, and Logger are mocked to isolate the service logic.

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
6.  **Active Employee Check:** The `isActive` flag in the `Employee` table serves as a kill switch. If set to `false` (termination/resignation), the user's SuperTokens session is revoked and their account deleted upon the next login attempt.
