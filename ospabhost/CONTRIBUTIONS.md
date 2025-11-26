#  Contributing to Ospabhost 8.1

Thank you for considering contributing to **Ospabhost 8.1**! This document provides guidelines for contributing.

---

##  Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)

---

##  Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity, level of experience, nationality, personal appearance, race, religion, sexual identity and orientation.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the project
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- Trolling, insulting comments, personal attacks
- Public or private harassment
- Publishing others' private information without permission

### Enforcement

Violations can be reported to:
- **Email:** support@ospab.host
- **Telegram:** @ospab_support

---

##  Getting Started

### Prerequisites

Before you begin, ensure you have:

\\\ash
# Node.js (v24.x or higher)
node --version

# npm (v10.x or higher)
npm --version

# MySQL (8.0 or higher)
mysql --version

# Git
git --version
\\\

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork locally:**
   \\\ash
   git clone https://github.com/YOUR_USERNAME/ospabhost8.1.git
   cd ospabhost8.1/ospabhost
   \\\

3. **Add upstream remote:**
   \\\ash
   git remote add upstream https://github.com/Ospab/ospabhost8.1.git
   \\\

### Setup Development Environment

#### Backend Setup

\\\ash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Setup database
npx prisma migrate deploy

# Run in development mode
npm run dev
\\\

#### Frontend Setup

\\\ash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
\\\

---

##  Development Workflow

### Create Feature Branch

\\\ash
git checkout -b feature/your-feature-name
# or for bug fixes:
git checkout -b fix/bug-description
\\\

### Make Changes

1. Make your changes following the coding standards below
2. Ensure tests pass: \
pm run test\
3. Build successfully: \
pm run build\

### Commit Changes

\\\ash
# Stage your changes
git add .

# Commit with a descriptive message
git commit -m "feat: Add new storage feature"

# Push to your fork
git push origin feature/your-feature-name
\\\

### Create Pull Request

1. Go to your fork on GitHub
2. Click "Compare & pull request"
3. Write a clear description of your changes
4. Reference any related issues: "Fixes #123"
5. Submit the PR

---

##  Coding Standards

### Backend (Express/TypeScript)

- Use **TypeScript** for type safety
- Follow **camelCase** for variables and functions
- Use **PascalCase** for classes and interfaces
- Keep functions small and focused
- Add JSDoc comments for public methods
- Use async/await instead of promises

Example:
\\\	ypescript
/**
 * Generates a secure password for storage credentials
 * @param length - Password length (default: 16)
 * @returns Generated password
 */
async function generateSecurePassword(length: number = 16): Promise<string> {
  // Implementation
}
\\\

### Frontend (React/TypeScript)

- Use **functional components** with hooks
- Use **TypeScript** for type safety
- Follow **camelCase** for functions and variables
- Use **PascalCase** for components
- Extract reusable components
- Keep components focused and small

Example:
\\\	ypescript
interface BucketProps {
  id: string;
  name: string;
  onDelete?: () => void;
}

export const BucketCard: React.FC<BucketProps> = ({ id, name, onDelete }) => {
  return <div>{name}</div>;
};
\\\

### General Rules

- Use **4 spaces** for indentation
- Add trailing commas in objects/arrays
- Use semicolons
- No console.log in production code
- Use meaningful variable names

---

##  Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

\\\
feat:  Add new feature (S3 storage, etc.)
fix:   Bug fixes
docs:  Documentation changes
style: Code formatting (no logic changes)
refactor: Code restructuring (no feature changes)
test:  Add or update tests
chore: Dependency updates, configuration changes
\\\

Examples:
- \eat: Add presigned URL generation for S3 downloads\
- \ix: Fix rate limiting for credential generation\
- \docs: Update API documentation\
- \	est: Add tests for storage service\

---

##  Pull Request Process

1. **Update your fork:**
   \\\ash
   git fetch upstream
   git rebase upstream/main
   \\\

2. **Resolve conflicts** if any

3. **Ensure tests pass:**
   \\\ash
   npm run test
   npm run lint
   npm run build
   \\\

4. **Push your changes:**
   \\\ash
   git push origin feature/your-feature-name
   \\\

5. **Create Pull Request** with:
   - Clear title describing your changes
   - Description of what and why you changed
   - Reference to any related issues
   - Screenshots if UI changes

6. **Address review feedback:**
   - Make requested changes
   - Push new commits
   - Request re-review

---

##  Testing Requirements

### Backend Tests

\\\ash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test -- storage.service.test.ts
\\\

### Frontend Tests

\\\ash
# Run tests
npm run test

# Run with coverage
npm run test -- --coverage
\\\

### Code Quality

\\\ash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
\\\

---

##  Project Structure

\\\
backend/src/modules/
 storage/          # S3 Object Storage
 auth/             # Authentication
 ticket/           # Support Tickets
 check/            # Payment Checks
 tariff/           # Tariff Plans
 notification/     # Notifications

frontend/src/
 pages/            # Route pages
 components/       # Reusable components
 context/          # React Context (Auth)
 lib/              # Utilities and API client
 App.tsx           # Main component
\\\

---

##  File Upload Feature Development

### Upload Implementation

The frontend supports multiple upload methods in `frontend/src/pages/dashboard/storage-bucket.tsx`:

**1. Drag & Drop Upload**
- Uses React's `DragEvent` handlers
- Files extracted from `event.dataTransfer.files`
- Triggers `performUpload()` callback

**2. File Selection**
- Single input with `multiple` attribute
- Handled via `handleUploadInput()` event
- Converts FileList to File[] array

**3. Directory Upload**
- Uses `webkitdirectory` and `mozdirectory` attributes
- Creates recursive file upload maintaining folder structure
- Path prefix combines with directory structure

**4. URI Upload**
- `handleUriUpload()` fetches from remote URL
- Creates File object from Blob response
- Integrates with standard upload flow

### Progress Tracking

Upload progress is tracked via XMLHttpRequest:

\\\typescript
const xhr = new XMLHttpRequest();

xhr.upload.addEventListener('progress', (event) => {
  if (event.lengthComputable) {
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = elapsed > 0 ? event.loaded / elapsed : 0;
    const percentage = Math.round((event.loaded / event.total) * 100);
    
    setUploadProgress({
      loaded: event.loaded,
      total: event.total,
      speed,
      percentage
    });
  }
});
\\\

**Key Types:**
- `UploadProgress`: Tracks individual file upload metrics
- `uploadStats`: Displays current file and progress counter
- `uploadAbortControllerRef`: Ref to AbortController for canceling uploads

---

##  Upload Cancellation

Users can cancel ongoing uploads:

\\\typescript
const handleCancelUpload = useCallback(() => {
  if (uploadAbortControllerRef.current) {
    uploadAbortControllerRef.current.abort();
    uploadAbortControllerRef.current = null;
  }
  setUploading(false);
  setUploadProgress({});
  setUploadStats({ currentFile: '', completedFiles: 0, totalFiles: 0 });
  addToast('Загрузка отменена', 'info');
}, [addToast]);
\\\

---

##  URI Download via Proxy

To bypass CORS limitations, URI downloads use backend proxy:

\\\
POST /api/storage/buckets/:id/objects/download-from-uri
{
  "url": "https://example.com/file.zip"
}
\\\

Response:
\\\json
{
  "blob": "base64_encoded_file_data",
  "mimeType": "application/zip"
}
\\\

This avoids CORS errors by handling the request server-side.

---

##  Need Help?

-  Read [README.md](./README.md)
-  Ask in [GitHub Discussions](https://github.com/Ospab/ospabhost8.1/discussions)
-  Report bugs in [GitHub Issues](https://github.com/Ospab/ospabhost8.1/issues)
-  Email: support@ospab.host

---

##  Thank You!

Thank you for contributing to Ospabhost 8.1! Your efforts help make this project better for everyone.

**Happy Coding! **
