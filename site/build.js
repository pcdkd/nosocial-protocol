import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { marked } from 'marked';

const ROOT = dirname(dirname(import.meta.url.replace('file://', '')));
const DOCS = join(ROOT, 'docs');
const SITE = join(ROOT, 'site');
const SPEC = join(ROOT, 'spec');

// Base path for URLs — empty for custom domain (nosocial.me), '/nosocial-protocol' for GitHub Pages
const BASE = process.env.SITE_BASE || '';

// --- Clean docs/ (preserve CNAME) ---

if (existsSync(DOCS)) {
  const cname = existsSync(join(DOCS, 'CNAME'))
    ? readFileSync(join(DOCS, 'CNAME'), 'utf-8')
    : null;
  rmSync(DOCS, { recursive: true });
  mkdirSync(DOCS, { recursive: true });
  if (cname) writeFileSync(join(DOCS, 'CNAME'), cname);
} else {
  mkdirSync(DOCS, { recursive: true });
}

// Prevent Jekyll processing on GitHub Pages
writeFileSync(join(DOCS, '.nojekyll'), '');

// --- Copy shared CSS ---

cpSync(join(SITE, 'style.css'), join(DOCS, 'style.css'));

// --- CNAME ---

if (!existsSync(join(DOCS, 'CNAME'))) {
  writeFileSync(join(DOCS, 'CNAME'), 'nosocial.me');
}

// --- Landing page ---

const landingHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>nosocial — the reputation layer for autonomous agents</title>
  <meta name="description" content="NoSocial is the reputation and discovery layer for autonomous agent networks. Identity, trust, and observability for the agent economy.">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='2' fill='%230a0a0a'/><text x='3' y='13' font-size='12' fill='%2300ff41'>▌</text></svg>">
  <link rel="stylesheet" href="${BASE}/style.css">
  <link rel="alternate" type="text/plain" href="${BASE}/llms.txt" title="LLM-readable site index">
</head>
<body>
  <main class="landing">
    <h1 class="landing-title glitch">nosocial<span class="cursor">▌</span></h1>
    <p class="landing-tagline">the reputation layer for autonomous agents</p>
    <nav class="landing-nav">
      <a href="${BASE}/extensions/agent-profile">spec</a>
      <a href="${BASE}/schemas/agent-profile/0.1.0/schema.json">schemas</a>
      <a href="https://github.com/pcdkd/nosocial-protocol">github</a>
    </nav>
    <footer class="landing-footer">v0.1.0 — MIT</footer>
  </main>
</body>
</html>`;

writeFileSync(join(DOCS, 'index.html'), landingHtml);

// --- Spec page ---

const specMd = readFileSync(join(SPEC, 'agent-profile-extension.md'), 'utf-8');

// Configure marked for heading IDs
marked.use({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const raw = tokens.map(t => t.raw || t.text || '').join('');
      const id = raw
        .toLowerCase()
        .replace(/<[^>]*>/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      return `<h${depth} id="${id}"><a href="#${id}">${text}</a></h${depth}>`;
    },
  },
});

const specBody = marked.parse(specMd);

const specHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NoSocial Agent Profile Extension v0.1.0</title>
  <meta name="description" content="The NoSocial Agent Profile Extension adds reputation, history, and evolution metadata to A2A Agent Cards.">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='2' fill='%230a0a0a'/><text x='3' y='13' font-size='12' fill='%2300ff41'>▌</text></svg>">
  <link rel="stylesheet" href="${BASE}/style.css">
  <link rel="alternate" type="text/markdown" href="${BASE}/extensions/agent-profile/spec.md" title="Spec (Markdown)">
</head>
<body>
  <nav class="spec-nav">
    <a href="${BASE}/">← nosocial</a>
    <span>Agent Profile Extension v0.1.0</span>
  </nav>
  <article class="spec-content">
    ${specBody}
  </article>
</body>
</html>`;

mkdirSync(join(DOCS, 'extensions', 'agent-profile'), { recursive: true });
writeFileSync(join(DOCS, 'extensions', 'agent-profile', 'index.html'), specHtml);

// Raw markdown for LLM consumption
writeFileSync(join(DOCS, 'extensions', 'agent-profile', 'spec.md'), specMd);

// --- Schema files ---

const schemas = [
  {
    src: join(SPEC, 'schemas', 'agent-profile.schema.json'),
    dest: join(DOCS, 'schemas', 'agent-profile', '0.1.0', 'schema.json'),
  },
  {
    src: join(SPEC, 'schemas', 'interaction-report.schema.json'),
    dest: join(DOCS, 'schemas', 'interaction-report', '0.1.0', 'schema.json'),
  },
];

for (const { src, dest } of schemas) {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
}

// --- llms.txt (site index for LLM ingestion) ---

const llmsTxt = `# NoSocial

> The reputation and discovery layer for autonomous agent networks.

NoSocial extends A2A Agent Cards with reputation scores, collaboration history, and capability evolution — so agents can make informed decisions about *which* agents to work with, not just *how* to reach them.

## Spec

- [Agent Profile Extension (Markdown)](${BASE}/extensions/agent-profile/spec.md): Full specification — identity, reputation scoring algorithm, interaction reports, discovery API, versioning.
- [Agent Profile Extension (HTML)](${BASE}/extensions/agent-profile): Same spec rendered for browsers.

## Schemas

- [Agent Profile JSON Schema](${BASE}/schemas/agent-profile/0.1.0/schema.json): Validates NoSocial Agent Profile objects (identity, reputation, history, evolution).
- [Interaction Report JSON Schema](${BASE}/schemas/interaction-report/0.1.0/schema.json): Validates signed interaction reports submitted to the reputation oracle.

## API

- Oracle endpoint: https://api.nosocial.me
- \`GET /v1/agents/{did}\` — Full agent profile
- \`GET /v1/agents/{did}/reputation\` — Reputation scores
- \`GET /v1/agents/search?capability=X&min_reputation=0.7\` — Discovery
- \`POST /v1/reports\` — Submit interaction report

## Source

- [GitHub](https://github.com/pcdkd/nosocial-protocol)
`;

writeFileSync(join(DOCS, 'llms.txt'), llmsTxt);

// --- llms-full.txt (complete spec + schemas for single-fetch LLM ingestion) ---

const agentProfileSchema = readFileSync(join(SPEC, 'schemas', 'agent-profile.schema.json'), 'utf-8');
const interactionReportSchema = readFileSync(join(SPEC, 'schemas', 'interaction-report.schema.json'), 'utf-8');

const llmsFullTxt = `# NoSocial — Complete Specification

> The reputation and discovery layer for autonomous agent networks.

---

${specMd}

---

## Agent Profile JSON Schema

\`\`\`json
${agentProfileSchema}
\`\`\`

---

## Interaction Report JSON Schema

\`\`\`json
${interactionReportSchema}
\`\`\`
`;

writeFileSync(join(DOCS, 'llms-full.txt'), llmsFullTxt);

console.log('Site built → docs/');
console.log('  index.html');
console.log('  style.css');
console.log('  llms.txt');
console.log('  llms-full.txt');
console.log('  extensions/agent-profile/index.html');
console.log('  extensions/agent-profile/spec.md');
console.log('  schemas/agent-profile/0.1.0/schema.json');
console.log('  schemas/interaction-report/0.1.0/schema.json');
