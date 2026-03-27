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

console.log('Site built → docs/');
console.log('  index.html');
console.log('  style.css');
console.log('  extensions/agent-profile/index.html');
console.log('  schemas/agent-profile/0.1.0/schema.json');
console.log('  schemas/interaction-report/0.1.0/schema.json');
