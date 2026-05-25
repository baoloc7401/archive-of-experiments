# archive-of-experiments

A personal sandbox for testing algorithms, exploring ideas, and learning through code.

Built with **React + Vite + TypeScript**.

## Run locally

```bash
npm install
npm run dev
```

## Structure

```
src/
  experiments.ts          # experiment registry
  components/
    ExperimentCard.tsx    # card component
  App.tsx                 # gateway index
```

Each experiment lives under `src/experiments/<id>/`. Add a new entry to `experiments.ts` to surface it on the index.

## Status tags

| Badge    | Meaning                       |
|----------|-------------------------------|
| LIVE     | Finished and interactive      |
| WIP      | In progress                   |
| PLANNED  | On the list                   |

## Philosophy

> The best way to learn is to build something, break it, and understand why.
