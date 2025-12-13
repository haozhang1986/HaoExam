---
description: Execute automated browser tests for HaoExam website and generate test report
---

# HaoExam Automated Testing Workflow

This workflow allows Antigravity to automatically test the HaoExam website using the browser subagent.

## Prerequisites
// turbo-all
1. Ensure backend server is running: `cd backend && uvicorn app.main:app --reload --port 8000`
2. Wait 3 seconds for server to be ready

## Execution Steps

### Step 1: Run Automated Tests
Read the test specification file at `.agent/tests/test_spec.json` and execute each test case using the browser_subagent tool.

For each test case:
1. Navigate to the specified URL
2. Perform the actions described
3. Verify the expected results
4. Record PASS/FAIL and any error messages
5. Take a screenshot on failure

### Step 2: Generate Test Report
After all tests complete, create a test report at `.agent/tests/test_report.md` with:
- Summary of passed/failed tests
- List of failed tests with error details
- Screenshots of failures
- Suggestions for fixes

## Test Commands

To run all tests, use this prompt:
```
请执行 HaoExam 自动化测试
```

To run specific test category:
```
请执行 HaoExam 测试：[category_name]
```

Available categories:
- page_load
- auth
- filters
- id_search
- card_interaction
- pdf_generation
- upload
- management

## Output
Test results will be saved to:
- `.agent/tests/test_report.md` - Human-readable report
- `.agent/tests/test_results.json` - Machine-readable results
