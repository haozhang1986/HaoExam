# HaoExam

A comprehensive exam preparation question bank system featuring AI-powered search, PDF generation, and management tools.

## 🚀 Getting Started

1. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

2. **Frontend**
   - Serve the `frontend` directory using any static file server or verify `index.html` via the backend static mount.

## 🧪 Testing

We ensure code quality through rigorous testing.

### Manual Testing
Please refer to [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md) for a comprehensive checklist covering all features (Auth, Filters, PDF, etc.).

### Automated Testing
This project includes an automated testing workflow for the Antigravity agent.
- Workflow definition: `.agent/workflows/run-tests.md`
- To run tests: Ask the agent to `/run-tests` or "Execute HaoExam automated tests".
