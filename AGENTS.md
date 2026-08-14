# Repository guide

This is a Bun-managed Next.js 16 App Router site using React 19, strict TypeScript, Tailwind CSS v4, shadcn-style Radix primitives, and Lucide icons.

## Where things live

- `app/layout.tsx` owns global metadata, fonts, and the always-dark root shell.
- `app/page.tsx` is the personal homepage. Keep its section anchors in sync with the sticky navigation.
- `app/you-got-this/` and `app/polar-bears/` are standalone randomized experiments. The former is force-dynamic; the latter regenerates hourly.
- `app/exercises/` contains the exercise tracker's routes: dashboard, logging, history, templates, and stats.
- `components/exercises/` contains tracker workflows and stateful UI. Route pages should mostly compose these components.
- `lib/exerciseTypes.ts` is the canonical tracker data model.
- `lib/exerciseStorage.ts` is the tracker persistence boundary. Data is local-only browser `localStorage` under `exercises`, `workouts`, and `templates`; there is no backend or migration layer.
- `lib/exerciseUtils.ts` owns shared type guards, volume calculations, dates, and IDs. Dumbbell weight counts twice when calculating volume.
- `components/ui/` contains reusable shadcn-style primitives. Extend these before creating one-off versions; use `cn` from `lib/utils.ts` for class merging.
- `app/globals.css` and `tailwind.config.ts` own global theme tokens and Tailwind configuration. Static images belong in `public/images/`.

Use the `@/` alias for imports from the repository root.

## Working conventions

- Preserve the Server Component default. Add `'use client'` only for hooks, browser APIs, or event handlers.
- Do not read `localStorage` during server rendering. Keep tracker persistence calls behind client boundaries and retain the `typeof window` guard in the storage layer.
- When changing persisted tracker shapes, update the types, storage behavior, forms, history/templates, and charts together. Existing browser data may use the old shape, so add backward-compatible normalization or an explicit migration when needed.
- Keep strength and cardio handling type-safe through the `ExerciseEntry` union and the helpers in `exerciseUtils.ts`; avoid unchecked casts.
- Reuse theme variables and existing responsive Tailwind patterns. The root layout forces dark mode.
- Follow the formatting already present in the file you touch; the repository does not currently enforce a separate formatter.
- Keep unrelated playground routes independent unless a shared primitive genuinely belongs in `components/` or `lib/`.

## Commands and validation

Run commands from the repository root:

```sh
bun install
bun run dev
bun run lint
bun run build
git diff --check
```

There is currently no automated test suite. For every change, run lint and the production build. Then manually exercise the affected route; tracker changes also require browser checks with both empty and existing `localStorage` data, including reload/navigation behavior. Do not treat a successful build as proof of client-side persistence behavior.
