# Adding an Experiment

Four touchpoints to ship a new experiment. Convention: `id` is kebab-case.

### 1. Register it - [`src/experiments.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments.ts)

```ts
{ id: "my-thing", tags: ["algorithms"], status: "active", path: "/experiments/my-thing" }
```

`status` is `"active"` (full-card link), `"wip"`, or `"planned"`.

### 2. Route it - [`src/main.tsx`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/main.tsx)

```tsx
import MyThing from "./experiments/my-thing";
// …
<Route path="/experiments/my-thing" element={<MyThing />} />
```

### 3. Build it - `src/experiments/my-thing/index.tsx`

Default-export the page component. Folder convention:
`index.tsx` (mandatory), `{Name}.css`, `types.ts`, `constants.ts`, `components/`.
Prefix CSS classes (`mything-`). Use the shared topbar:

```tsx
import ExperimentHeader from "../../components/ExperimentHeader";
// <ExperimentHeader title="my thing" subtitle="…" />
```

Shared imports available from inside an experiment:

- `../../components/ExperimentHeader` - topbar with back link, title, toggles
- `../../components/ScrambleText` - decode-animation text
- `../../components/LangToggle` / `ThemeToggle`
- `../../hooks/useTheme` - `{ theme, toggle }`

### 4. Translate it - [`src/i18n/locales/{en,vi}.ts`](https://github.com/baoloc7401/archive-of-experiments/tree/main/src/i18n/locales)

Add `experiments.my-thing.title` and `.description` to **both** locales (keep
them in sync).

---

## Before committing

```bash
npx tsc --noEmit && npm run build   # type-check + production build
npm run lint                        # ESLint
```

Commit style: `type: short description` (lowercase, imperative, no period).
Types: `feat`, `fix`, `refactor`, `chore`, `docs`. **Never `git push`** - only
the maintainer pushes.

## Document it (optional but encouraged)

If the experiment models a real algorithm, write a research doc - see
[[Documentation Conventions]] and the `docs-textbook` / `docs-issues` /
`docs-improvements` skills.

See also: [[Architecture]]
