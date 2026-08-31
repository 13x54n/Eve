# Pre-commit Hooks

This project uses Husky and lint-staged to run automated checks before committing code.

## What Gets Checked

### On Every Commit (pre-commit)

1. **Linting**: ESLint runs on staged files
2. **Formatting**: Prettier formats code automatically
3. **Type checking**: TypeScript files are validated

### On Push (pre-push)

1. **Branch warning**: Warns when pushing to main/h3 directly

## Setup

Hooks are installed automatically when you run `npm install` at the root.

To manually install:
```bash
npm install
npm run prepare
```

## Bypassing Hooks

**Not recommended**, but if you need to:

```bash
# Skip pre-commit hooks
git commit --no-verify

# Skip pre-push hooks
git push --no-verify
```

## Customizing

### Adding New Checks

Edit `.husky/pre-commit` or `.husky/pre-push`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Add your custom checks here
npm test
npx lint-staged
```

### Modifying lint-staged

Edit `lint-staged` configuration in `package.json`:

```json
{
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"]
  }
}
```

## Troubleshooting

### Hooks not running

```bash
# Reinstall hooks
rm -rf .husky/_
npm run prepare
```

### Hooks failing

Check the error message and fix the issues, or:

1. Run linter manually: `npm run lint`
2. Format code: `npm run format`
3. Fix issues and retry commit

### Permission denied

```bash
chmod +x .husky/*
```

## Benefits

✅ Consistent code style across team
✅ Catch errors before they reach CI
✅ Faster feedback loop
✅ Reduced review friction
✅ Automated best practices
