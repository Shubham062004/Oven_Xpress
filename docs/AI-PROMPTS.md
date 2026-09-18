# AI Prompt Library

Reusable prompt templates for development tasks. Copy and adapt as needed.

---

## Categories

1. Project setup
2. Feature implementation
3. CRUD implementation
4. API implementation
5. Database changes
6. UI implementation
7. Bug fixing
8. Refactoring
9. Code review
10. Security review
11. Performance optimization
12. Manual testing
13. Regression testing
14. Documentation

---

## Templates

### Feature Implementation

```
# Feature: [Name]

## Context
- Module: [module name]
- Related files: [list key files]
- Dependencies: [list any dependencies]

## Requirements
- [Requirement 1]
- [Requirement 2]

## Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

## Constraints
- Follow existing design system tokens
- Use Server Components where possible
- Use shadcn/ui components
- Follow TypeScript strict mode
- Add proper accessible labels
- Handle loading, empty, and error states
```

### Bug Fixing

```
# Bug: [Title]

## Observed Behavior
[What happens]

## Expected Behavior
[What should happen]

## Steps to Reproduce
1. [Step 1]
2. [Step 2]

## Environment
- Browser: [browser]
- Viewport: [size]
- Theme: [light/dark]

## Investigation Notes
- [Any findings]

## Constraints
- Do not introduce new dependencies
- Preserve existing tests
- Fix root cause, not symptoms
```

### Code Review

```
# Code Review: [PR/Change Title]

## Review Checklist
- [ ] TypeScript strict compliance (no `any`)
- [ ] Components use design tokens, not hardcoded values
- [ ] Semantic HTML and accessible labels
- [ ] Responsive at 390px, 768px, 1024px, 1440px
- [ ] Loading, empty, error states handled
- [ ] Server Components used where possible
- [ ] No unnecessary client-side state
- [ ] No inline styles
- [ ] Consistent naming conventions
- [ ] No duplicate UI logic
- [ ] Both themes render correctly
- [ ] No console errors or warnings
```

### Manual Testing

```
# Manual Test: [Feature/Page]

## Test Environment
- Browser: [browser]
- Viewport sizes: 390px, 768px, 1024px, 1440px

## Test Cases

### Functional
- [ ] [Core action works]
- [ ] [Edge case handled]

### Visual
- [ ] Light theme renders correctly
- [ ] Dark theme renders correctly
- [ ] No horizontal overflow at any breakpoint
- [ ] Spacing and alignment consistent

### Accessibility
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] Screen reader labels present
- [ ] Contrast ratios sufficient

### States
- [ ] Loading state shows skeletons
- [ ] Empty state shows message and action
- [ ] Error state shows clear message

## Results
- Pass: [count]
- Fail: [count]
- Notes: [any observations]
```
