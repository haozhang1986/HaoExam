# Changelog

All notable changes to HaoExam will be documented in this file.

## [v2.2-beta] - 2025-01-08

### Added - User Authentication & RBAC System

Complete role-based access control system with three permission levels:

#### Backend Authentication (`backend/app/auth.py`)
- **RBAC Role System**: Admin / Teacher / Student permission levels
- `require_role()` decorator for endpoint protection
- Pre-defined role dependencies: `require_admin`, `require_teacher_or_admin`
- Configuration externalized to `config.py` (SECRET_KEY, JWT_ALGORITHM)

#### Backend User Initialization (`backend/app/main.py`)
- **Default User Creation**: Auto-create test accounts on startup
  - `admin` / `admin123` (Admin - full access)
  - `teacher` / `teacher123` (Teacher - Gallery + Generator)
  - `student` / `student123` (Student - Gallery only)
- Generator endpoints now require Teacher+ permission

#### Frontend Auth Store (`frontend/src/store/authStore.ts`)
- Zustand store with `persist` middleware (localStorage)
- Login/logout operations with API integration
- Role-based permission checking: `hasRole()`, `canAccess()`
- Global login modal state management

#### Frontend Components
- **LoginModal** (`components/LoginModal.tsx`)
  - Pixel-art styled login form
  - Supports modal and fullscreen modes
  - Error display with retro styling

- **ProtectedRoute** (`components/ProtectedRoute.tsx`)
  - Route guard component with role checking
  - "ACCESS DENIED" screen for unauthenticated users
  - "FORBIDDEN" screen for insufficient permissions

- **Navbar** (`components/Navbar.tsx`)
  - Global navigation bar component
  - User status display (username + role)
  - Login/Logout buttons

#### Homepage Updates (`frontend/src/App.tsx`)
- Feature cards show lock overlay for unauthorized access
- Click locked card → open login modal
- Status bar shows login state: "LOGGED IN" / "GUEST"
- Search bar functional → redirects to Gallery with keyword

### Added - Keyword Search

- **Gallery Page**: New keyword search input filter
- **Homepage**: Search box redirects to `/gallery?keyword=xxx`
- **Backend**: Added `keyword` parameter to `/questions/` endpoint
- URL parameter synchronization for bookmarkable searches

### Added - Question Drag & Drop Reorder

- **GeneratedResults**: Drag-and-drop question reordering in generator
- `reorderQuestions()` action in generatorStore
- Visual feedback during drag operations

### Improved - Database Models (`backend/app/models.py`)

Complete model refactoring with detailed documentation:

| Field | Change | Description |
|-------|--------|-------------|
| `source_filename` | NEW | Track origin file for batch delete |
| `subject_code` | NEW | Subject code: "9709", "9702" |
| `question_index` | NEW | Numeric sorting index |
| `answer_text` | NEW | MCQ text answer: "A", "B", "C", "D" |
| `Tag.paper` | REMOVED | Simplified tag model |
| `Tag.subject` | REMOVED | Tags now universal |
| `Tag.color` | NEW | Tag color code |

### Improved - PDF Generation (`backend/app/pdf_engine.py`)

- **Fixed**: Large images no longer overflow pages
- **Added**: Question labels with ID and number
- **Added**: "--- Answer ---" separator line styling
- **Improved**: Page break logic for tall images
- **Improved**: Logging with proper logger instead of print

### Improved - Generator Store Performance (`frontend/src/store/generatorStore.ts`)

- **Shallow Selectors**: Optimized re-renders with `useShallow`
  - `useTopicMixerStore()` - TopicMixer only
  - `useDifficultyStore()` - DifficultyEqualizer only
  - `useGeneratedResultsStore()` - Results only
  - `useExamSetupStore()` - Setup panel only
- `normalizeSubtopicWeights(topic)` - Normalize single topic's subtopics
- `reorderQuestions(from, to)` - Drag-drop support

### Improved - Generator Page Validation

- Frontend pre-validation before API call:
  - Topic weights must sum to 100%
  - Difficulty ratio must sum to 100%
  - Clear error messages with fix suggestions

### Changed - Route Permissions

| Route | v2.1 | v2.2 |
|-------|------|------|
| `/gallery` | Public | Public |
| `/generator` | Public | Teacher + Admin |
| `/studio` | Public | Admin only |
| `/admin/upload` | Public | Admin only |

### Removed - Legacy Files

Cleaned up deprecated frontend files:
- `frontend/app.js` (2081 lines)
- `frontend/style.css` (913 lines)
- `frontend/multi-select.js`
- `frontend/zip-upload.js`
- `frontend/debug.html`
- `frontend/haoexam_logo.png`
- `backend/syllabus/*.json` (moved to static config)

---

## [v2.1-beta] - 2025-01-05

### Added - Smart Exam Generator System

A complete intelligent exam generation system with three-dimensional control:

#### Backend (`backend/app/services/generator.py`)
- **SmartExamGenerator** class with 3-step algorithm:
  1. **Bucket Allocation**: Distribute questions based on nested topic/subtopic weights
  2. **Difficulty Mapping**: Allocate Easy/Medium/Hard counts and randomly distribute to slots
  3. **Query & Fallback**: Query database with fallback logic prioritizing subtopic match over difficulty
- **Reroll functionality**: Replace individual questions while maintaining topic/subtopic constraints
- Duplicate prevention using question ID tracking
- New API endpoints:
  - `POST /api/generator/smart` - Main generation endpoint
  - `POST /api/generator/reroll` - Single question replacement

#### Frontend - Generator Page (`frontend/src/pages/GeneratorPage.tsx`)
- New `/generator` route for smart exam generation
- Three-panel layout: Configuration (left) + Generate/Results (right)
- Subject/Paper/Question count selectors

#### Frontend - UI Components
- **DifficultyEqualizer** (`components/generator/DifficultyEqualizer.tsx`)
  - Audio EQ style vertical sliders for Easy/Medium/Hard
  - Linked sliders that maintain 100% total
  - Green/Yellow/Red color coding with emoji indicators

- **TopicMixer** (`components/generator/TopicMixer.tsx`)
  - Accordion structure with expand/collapse for topics
  - Nested subtopic sliders within each topic
  - Click-to-edit percentage inputs (click number to type directly)
  - **RESET** button: Set all weights to 0%
  - **FIX** button: Auto-normalize to 100% (appears when total != 100%)
  - Visual feedback: Green badge when 100%, Yellow when not

- **GeneratedResults** (`components/generator/GeneratedResults.tsx`)
  - 2-column grid of question preview cards
  - Difficulty color badges (E/M/H)
  - Lightbox image preview on click
  - Reroll button (dice icon) per question
  - "Add All to Cart" integration with paper basket

#### State Management (`frontend/src/store/generatorStore.ts`)
- Zustand store for generator state
- Linked difficulty slider logic
- Topic/subtopic weight management
- Reset and normalize actions

#### API Integration (`frontend/src/services/api.ts`)
- `generateSmartExam()` - POST to /api/generator/smart
- `rerollQuestion()` - POST to /api/generator/reroll
- `fetchQuestionsByIds()` - Batch fetch with chunking support

### Changed
- Updated `backend/app/crud.py`: Support multiple ID queries (`id` parameter accepts `List[int]`)
- Updated `backend/app/main.py`: Added generator endpoints and multi-ID support
- Updated `backend/app/schemas.py`: Added 7 new schemas for smart generator
- Updated `frontend/src/App.tsx`: Enabled AUTO_GENERATE feature card, added `/generator` route

---

## [v2.0-beta] - 2024-12-17

### Added - Multi-Select Filter System
- Multi-select support for Topic and Subtopic filters in Gallery
- Enhanced filter UI with chip-based selection
- Improved question browsing experience

---

## [v1.1-alpha] - 2024-12-15

### Fixed
- PDF download functionality
- ID search enhancement

### Added
- Automated testing framework (`backend/tests/`)

---

## [v1.0-alpha] - 2024-12-10

### Added - Initial Release
- Question bank management system
- ZIP batch import functionality
- Gallery page with infinite scroll
- Studio page for manual question editing
- Paper basket (floating cart) for exam assembly
- PDF worksheet generation
- Pixel art NES-style UI theme
- FastAPI backend with SQLAlchemy ORM
- React + TypeScript + Tailwind CSS frontend
