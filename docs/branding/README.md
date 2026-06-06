# Branding

Source/master assets for the *Archive of Experiments* mark. These are **not
shipped** — nothing here is imported by the app or copied to `dist/`. The files
the site actually serves live in [`public/`](../../public/) and are derived from
these masters.

## The mark

A single bold lightning bolt — the "experiment spark" — filled with a diagonal
gradient that unites the site's two accent colors, on a dark rounded tile.

| Token        | Value                       | Use                          |
| ------------ | --------------------------- | ---------------------------- |
| Tile         | `#0a0b12` → `#07080d`       | rounded-square background    |
| Bolt start   | `#00f5c4` (`--accent`)      | top of gradient (mint-teal)  |
| Bolt end     | `#7c6cfa` (`--accent2`)     | bottom of gradient (violet)  |
| Border       | `#1d2030`                   | thin tile edge               |
| Mono fill    | `#e2e8f8` (`--text-hi`)     | monochrome variant           |

Geometry: 256×256 viewBox, tile `rx="56"`. Bolt is one path (no curves) so it
stays crisp at any size: `M7 2 L7 13 L10 13 L10 22 L17 10 L13 10 L17 2 Z`
(24-unit space, scaled ×7.5 and centered).

## Files

| File                   | What                                                    |
| ---------------------- | ------------------------------------------------------- |
| `icon-master.svg`      | Full concept — tile + glow + bolt.                      |
| `icon-app.svg`         | App-icon export (512), same composition.                |
| `favicon.svg`          | Simplified — no glow/node, thicker bolt. Master for the shipped favicon. |
| `icon-mono.svg`        | Monochrome, `currentColor`, transparent.                |
| `icon-master-1024.webp`| 1024 raster render (Hugging Face Z-Image, seed 7401).   |

## Shipped derivatives

- [`public/favicon.svg`](../../public/favicon.svg) — tab/app icon (mirrors `favicon.svg` here).
- [`public/og-image.svg`](../../public/og-image.svg) — social card; embeds the mark as a corner badge.
- [`public/og-image.png`](../../public/og-image.png) — rasterized card.

Regenerate the PNG card after editing `og-image.svg`:

```bash
node scripts/gen-og.mjs
```
