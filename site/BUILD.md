# nosocial.me Static Site — Build Instructions

## Overview

Build a static site for `nosocial.me` deployed via GitHub Pages from the `docs/` folder on `main`. The site renders the NoSocial spec, serves JSON schemas at canonical URLs, and maintains the existing CRT/cathode monitor aesthetic throughout.

## Design System — CRT Aesthetic

The current splash page at nosocial.me uses a retro cathode-ray monitor look. **Every page must follow this aesthetic:**

- **Background:** near-black (`#0a0a0a` or similar)
- **Text color:** bright terminal green (`#00ff41`) with a subtle glow (`text-shadow: 0 0 8px rgba(0,255,65,0.6)`)
- **Font:** monospace stack — `'IBM Plex Mono', 'Fira Code', 'Courier New', monospace`
- **Scan lines:** CSS `::after` overlay with repeating horizontal lines (`repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 3px)`)
- **Screen flicker:** subtle CSS animation — periodic opacity shift (e.g. `0.97 → 1.0`) on a 4–8s loop
- **Glitch effect:** occasional horizontal offset glitch on the hero text via `@keyframes` (translate + clip-path, random-feeling intervals using stepped animation)
- **Blinking cursor:** `▌` character after "nosocial" on the landing page, blinking via CSS `animation: blink 1s step-end infinite`
- **Links:** green, no underline by default, underline on hover. Visited links slightly dimmer green.
- **Headings:** same green, slightly larger monospace, optional `border-bottom: 1px solid #00ff41`
- **Code blocks / inline code:** slightly lighter background (`#111`), green text, 1px green border
- **Scrollbar:** style with `::-webkit-scrollbar` — thin, dark track, green thumb

Keep it minimal. No frameworks (React, Tailwind, etc.). Plain HTML + CSS + vanilla JS. One shared `style.css`.

## URL Structure

```
nosocial.me/                                          → Landing page
nosocial.me/extensions/agent-profile                  → Spec (rendered from markdown)
nosocial.me/schemas/agent-profile/0.1.0/schema.json   → JSON Schema (raw)
nosocial.me/schemas/interaction-report/0.1.0/schema.json → JSON Schema (raw)
```

## File Layout (output to `docs/`)

```
docs/
├── CNAME                          # contains: nosocial.me
├── index.html                     # Landing page
├── style.css                      # Shared CRT styles
├── extensions/
│   └── agent-profile/
│       └── index.html             # Spec rendered as HTML
└── schemas/
    ├── agent-profile/
    │   └── 0.1.0/
    │       └── schema.json        # Copy of spec/schemas/agent-profile.schema.json
    └── interaction-report/
        └── 0.1.0/
            └── schema.json        # Copy of spec/schemas/interaction-report.schema.json
```

## Page Details

### 1. Landing Page (`index.html`)

- Centered vertically and horizontally
- Large `nosocial` text with glitch animation + blinking cursor
- Tagline below: *"the reputation layer for autonomous agents"*
- Three nav links below tagline:
  - `spec` → `/extensions/agent-profile`
  - `schemas` → `/schemas/agent-profile/0.1.0/schema.json`
  - `github` → `https://github.com/pcdkd/nosocial-protocol`
- Small footer: `v0.1.0 — MIT`
- Full-viewport CRT overlay (scan lines + flicker)

### 2. Spec Page (`extensions/agent-profile/index.html`)

- **Source:** `spec/agent-profile-extension.md` from this repo
- Convert the markdown to HTML. Use a build script (Node, Python, or shell — whatever is simplest). Recommended: `marked` (npm) or `python-markdown`.
- Wrap the rendered HTML in the CRT-styled page shell (header nav, scan lines, flicker)
- Top nav bar: `← nosocial` link back to `/`, page title "Agent Profile Extension v0.1.0"
- Rendered spec in a readable column (max-width ~800px, centered)
- Markdown heading anchors for deep linking (e.g. `#reputation`)
- Style tables with green borders, no background fill
- Style the JSON/YAML code blocks with the code block treatment above

### 3. Schema Files

These are **raw JSON files**, not HTML. Just copy them from `spec/schemas/` into the correct `docs/schemas/` paths. Serve with correct `Content-Type: application/json` (GitHub Pages handles this automatically for `.json` files).

## Build Script

Create a `site/build.sh` (or `site/build.js`) that:

1. Cleans `docs/` (except `CNAME`)
2. Copies `style.css` into `docs/`
3. Renders `spec/agent-profile-extension.md` → HTML, wraps in page template, writes to `docs/extensions/agent-profile/index.html`
4. Copies schema JSON files to `docs/schemas/...`
5. Generates `docs/index.html` (landing page — can be a template string, no markdown needed)

Add to root `package.json`:
```json
"scripts": {
  "build:site": "node site/build.js"
}
```

## Deployment

- GitHub Pages configured to serve from `docs/` on `main`
- `CNAME` file contains `nosocial.me`
- DNS already configured (domain is live)
- Schema files must be served with correct paths — test with: `curl https://nosocial.me/schemas/agent-profile/0.1.0/schema.json`

## Constraints

- **No frameworks.** Plain HTML/CSS/JS only.
- **No client-side markdown rendering.** Pre-render at build time.
- **Total page weight < 50KB** per page (excluding fonts if loaded).
- **Zero JavaScript required for reading.** JS only for cosmetic glitch effects.
- **Accessible:** all text readable despite visual effects. Scan line overlay must not reduce contrast below 4.5:1.
- **`prefers-reduced-motion`:** disable flicker and glitch animations when set.

## Content Sources (relative to repo root)

| Content | Source file |
|---------|------------|
| Spec markdown | `spec/agent-profile-extension.md` |
| Agent Profile schema | `spec/schemas/agent-profile.schema.json` |
| Interaction Report schema | `spec/schemas/interaction-report.schema.json` |

That's it. Ship it dark and green.
