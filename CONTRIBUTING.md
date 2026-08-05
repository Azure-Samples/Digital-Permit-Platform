# Contributing

Thank you for considering a contribution to the Digital Permit Platform Solution Accelerator.

## Before you start

- Search existing issues and pull requests before opening a new one.
- Never include customer data, personal data, credentials, Azure resource identifiers, or screenshots containing sensitive information.
- Keep legislation, policies, and fees synthetic unless the contribution has a clear reusable source and review path.
- For a security vulnerability, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Development workflow

1. Fork the repository and create a focused branch.
2. Follow [Local development](docs/local-development.md).
3. Add or update tests for changed behavior.
4. Run the quality gates:

   ```bash
   npm ci
   npm run db:generate
   npm run lint
   npm run typecheck
   npm test
   npm run build
   npm audit --audit-level=low
   ```

5. If infrastructure changed, compile `infra/main.bicep` and describe cost, security, and migration effects.
6. If AI behavior changed, update the evaluation rationale and [responsible AI guidance](docs/responsible-ai.md).

## Pull requests

Pull requests should explain:

- the user or operator problem;
- the chosen implementation and alternatives considered;
- test evidence;
- security, privacy, accessibility, cost, and compatibility effects;
- documentation or deployment changes.

Keep generated output, local environments, videos, customer collateral, and editor settings out of commits.

## Contributor License Agreement

Most contributions require agreement to a Contributor License Agreement declaring that you have the right to grant, and do grant, the rights to use your contribution. When a pull request is submitted, a CLA bot will determine whether an agreement is required and provide instructions.

This project follows the [Microsoft Open Source Code of Conduct](CODE_OF_CONDUCT.md).
