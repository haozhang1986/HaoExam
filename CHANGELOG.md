# Changelog

All notable changes to HaoExam will be documented in this file.

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
