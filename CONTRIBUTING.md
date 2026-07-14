# Contributing to Rotordyn.ai

Thank you for contributing! Please follow these steps when working on the codebase:

## Development Workflow
1. Fork and create a feature branch off main: `git checkout -b feature/your-feature`.
2. Follow strict coding standards. Do not re-declare dynamic state variables inside React mounting closures.
3. Test your changes locally before submitting a PR.

## Verification Checklist
- Backend tests must compile and pass cleanly:
  ```bash
  python backend/tests/run_tests.py
  ```
- E2E Playwright tests must pass:
  ```bash
  python3 verify_ui.py
  ```
- Vite build must build without errors:
  ```bash
  npm run build
  ```
