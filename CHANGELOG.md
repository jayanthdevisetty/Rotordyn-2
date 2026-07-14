# Changelog

All notable changes to the Rotordyn.ai SaaS project will be documented in this file.

## [1.0.0-Beta] - 2026-07-14

### Added
- **Stripe payment checkout integration**: Real signature checking and verified upgrading loops.
- **Sentry instrumentation**: Dynamic capture scope mapping on unhandled FastAPI exceptions.
- **Prometheus metric collection**: Structured metric collector at `/metrics` path.
- **IndexedDB uploader cache**: Bypasses server bandwidth by storing CSV data on browser.
- **Audit Logging**: Persistent database tables tracking critical client modifications.

### Fixed
- **React routing and layout centering**: Restructured welcome/uploader pages path definitions.
- **Variable Hoisting TDZ errors**: Hoisted diagnostic calculation states globally to bypass mounting reference exceptions.
