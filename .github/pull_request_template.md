## Summary

<!-- What changes and why. Link the issue it closes (Closes #…) and any issues in other repositories. -->

## Checklist

- [ ] `pnpm check`, `pnpm test` and `pnpm build` pass
- [ ] Contract, handler and tests updated together for API changes
- [ ] `src/sql/init.sql` changes are idempotent and the tests' schema copy is updated
- [ ] New settings are runtime environment variables in `src/env.ts` and `.env.example`
- [ ] Breaking API changes are marked with `!` in the title
