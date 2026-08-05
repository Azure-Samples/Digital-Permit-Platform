## Summary

Describe the user/operator problem and the change.

## Implementation

Explain the approach, important design decisions, and alternatives considered.

## Validation

List commands and manual journeys run. Include relevant output without secrets or personal/customer data.

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm audit --audit-level=low`
- [ ] `npm run docs:check`
- [ ] `npm run validate:release`
- [ ] Bicep compiled when infrastructure changed
- [ ] Containers built when Dockerfiles/runtime dependencies changed

## Review checklist

- [ ] The change is focused and follows existing ownership boundaries.
- [ ] Tests cover changed behavior and failure paths.
- [ ] Documentation and configuration contracts are updated.
- [ ] No credentials, Azure identifiers, customer data, personal data, generated output, or large binaries were added.
- [ ] Security and privacy impacts were assessed.
- [ ] Accessibility was tested for affected user journeys.
- [ ] Responsible AI guidance/evaluation was updated for AI behavior changes.
- [ ] Cost and operational impacts were assessed for infrastructure or runtime changes.
- [ ] Database changes include a reviewed migration and recovery approach.

## Screenshots

Include only synthetic data. Remove this section when the change has no visible UI impact.
