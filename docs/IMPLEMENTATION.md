# MVP Implementation Notes

The repository starts as a modular monolith. The web app is the first distribution surface because it is shareable, responsive, and simpler to onboard than a browser extension.

## Vertical slice

1. Marketing page and onboarding entry point
2. Dashboard with actionable metrics
3. Mock-provider job discovery and explainable matching
4. Resume workspace with parse-preview UX
5. Application pipeline board

## Boundary rules

- Domain scoring remains independent from FastAPI and SQLAlchemy.
- Provider integrations normalize results behind a provider interface.
- Generated artifacts will remain immutable and tied to evidence from a master resume.
- PostgreSQL models are present, but API handlers use an in-memory provider until repository migrations land.
- Browser automation remains deferred until explicit consent and provider-policy controls exist.

