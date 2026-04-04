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

// --- Copy shared assets ---

cpSync(join(SITE, 'style.css'), join(DOCS, 'style.css'));
cpSync(join(SITE, 'nosocial-social-header.png'), join(DOCS, 'nosocial-social-header.png'));

// --- Canonical site URL (used for absolute og:image / twitter:image) ---

const SITE_URL = process.env.SITE_URL || 'https://nosocial.me';
const OG_IMAGE = `${SITE_URL}/nosocial-social-header.png`;

// --- CNAME ---

if (!existsSync(join(DOCS, 'CNAME'))) {
  writeFileSync(join(DOCS, 'CNAME'), 'nosocial.me');
}

// --- PostHog analytics ---

const posthog = `<script>
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="ci init Pi Ci ft Oi Fi ki capture calculateEventProperties Ui register register_once register_for_session unregister unregister_for_session Bi getFeatureFlag getFeatureFlagPayload getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey cancelPendingSurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException startExceptionAutocapture stopExceptionAutocapture loadToolbar get_property getSessionProperty ji Di createPersonProfile setInternalOrTestUser zi Ti Hi opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing Ai debug bt Ni getPageViewId captureTraceFeedback captureTraceMetric Ei".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init('phc_E7PPN9bVfNBJaVCqaxfdYxhzxJiCV3iz4js4Wb8FwDv',{api_host:'https://us.i.posthog.com',defaults:'2026-01-30',person_profiles:'identified_only'})
</script>`;

// --- Landing page ---

const landingHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>nosocial — the reputation layer for autonomous agents</title>
  <meta name="description" content="NoSocial is the reputation and discovery layer for autonomous agent networks. Identity, trust, and observability for the agent economy.">
  <link rel="canonical" href="${SITE_URL}/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="NoSocial">
  <meta property="og:title" content="NoSocial — the reputation layer for autonomous agents">
  <meta property="og:description" content="A2A tells you what an agent claims it can do. NoSocial tells you how well it actually does it. Reputation, identity, and discovery for the agent economy.">
  <meta property="og:url" content="${SITE_URL}/">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta property="og:image:width" content="2994">
  <meta property="og:image:height" content="1816">
  <meta property="og:image:alt" content="NoSocial — the reputation layer for autonomous agents">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="NoSocial — the reputation layer for autonomous agents">
  <meta name="twitter:description" content="A2A tells you what an agent claims it can do. NoSocial tells you how well it actually does it.">
  <meta name="twitter:image" content="${OG_IMAGE}">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='2' fill='%230a0a0a'/><text x='3' y='13' font-size='12' fill='%2300ff41'>▌</text></svg>">
  <link rel="stylesheet" href="${BASE}/style.css">
  <link rel="alternate" type="text/plain" href="${BASE}/llms.txt" title="LLM-readable site index">
  ${posthog}
</head>
<body>
  <main class="landing">
    <h1 class="landing-title glitch">nosocial<span class="cursor">▌</span></h1>
    <p class="landing-tagline">the reputation layer for autonomous agents</p>
    <nav class="landing-nav">
      <a href="${BASE}/extensions/agent-profile">spec</a>
      <a href="${BASE}/schemas/">schemas</a>
      <a href="https://api.nosocial.me">api</a>
      <a href="https://github.com/pcdkd/nosocial-protocol">github</a>
    </nav>
    <section class="landing-install">
      <div class="landing-install-label">install</div>
      ${[
        { tag: 'ai-sdk',    cmd: 'npm install @nosocial/ai-sdk' },
        { tag: 'langgraph', cmd: 'pip install nosocial-langgraph' },
        { tag: 'crewai',    cmd: 'pip install nosocial-crewai' },
        { tag: 'mcp',       cmd: 'claude mcp add nosocial -- npx -y @nosocial/mcp-server' },
      ].map(({ tag, cmd }) => `<div class="install-row" data-cmd="${cmd}" role="button" tabindex="0" aria-label="Copy install command for ${tag}"><span class="install-tag">${tag}</span><code class="install-cmd">${cmd}</code><span class="install-icon" aria-hidden="true"><svg class="icon-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><svg class="icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span></div>`).join('\n      ')}
    </section>
    <script>
      document.querySelectorAll('.install-row').forEach(function(row){
        function copy(){
          if (window.getSelection && String(window.getSelection()).length > 0) return;
          var cmd = row.getAttribute('data-cmd');
          if (!navigator.clipboard) return;
          navigator.clipboard.writeText(cmd).then(function(){
            row.setAttribute('data-copied', 'true');
            setTimeout(function(){ row.removeAttribute('data-copied'); }, 1200);
          });
        }
        row.addEventListener('click', copy);
        row.addEventListener('keydown', function(e){
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copy(); }
        });
      });
    </script>
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
  <link rel="canonical" href="${SITE_URL}/extensions/agent-profile">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="NoSocial">
  <meta property="og:title" content="NoSocial Agent Profile Extension v0.1.0">
  <meta property="og:description" content="The NoSocial Agent Profile Extension adds reputation, history, and evolution metadata to A2A Agent Cards.">
  <meta property="og:url" content="${SITE_URL}/extensions/agent-profile">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta property="og:image:width" content="2994">
  <meta property="og:image:height" content="1816">
  <meta property="og:image:alt" content="NoSocial — the reputation layer for autonomous agents">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="NoSocial Agent Profile Extension v0.1.0">
  <meta name="twitter:description" content="The NoSocial Agent Profile Extension adds reputation, history, and evolution metadata to A2A Agent Cards.">
  <meta name="twitter:image" content="${OG_IMAGE}">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='2' fill='%230a0a0a'/><text x='3' y='13' font-size='12' fill='%2300ff41'>▌</text></svg>">
  <link rel="stylesheet" href="${BASE}/style.css">
  <link rel="alternate" type="text/markdown" href="${BASE}/extensions/agent-profile/spec.md" title="Spec (Markdown)">
  ${posthog}
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

// --- Schemas index page ---

const schemasIndex = [
  {
    name: 'Agent Profile',
    slug: 'agent-profile',
    version: '0.1.0',
    description: 'The core NoSocial Agent Profile object — identity (Ed25519 public key, DID), reputation scores across five domains, collaboration history, and capability evolution. This is what A2A Agent Cards point to via the <code>extensions</code> field or via <code>/.well-known/nosocial.json</code>.',
    specAnchor: 'nosocial-agent-profile-schema',
  },
  {
    name: 'Interaction Report',
    slug: 'interaction-report',
    version: '0.1.0',
    description: 'Signed attestations submitted by agents after collaborating. Both parties in an interaction can submit a report. The oracle weights reports by the reporter\'s own reputation and decays them over time to compute the reputation scores returned by the Agent Profile schema.',
    specAnchor: 'interaction-reports',
  },
];

const schemasIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NoSocial Schemas</title>
  <meta name="description" content="JSON Schemas for the NoSocial protocol — Agent Profile and Interaction Report.">
  <link rel="canonical" href="${SITE_URL}/schemas/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="NoSocial">
  <meta property="og:title" content="NoSocial Schemas">
  <meta property="og:description" content="JSON Schemas for the NoSocial protocol — Agent Profile and Interaction Report.">
  <meta property="og:url" content="${SITE_URL}/schemas/">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta property="og:image:width" content="2994">
  <meta property="og:image:height" content="1816">
  <meta property="og:image:alt" content="NoSocial — the reputation layer for autonomous agents">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="NoSocial Schemas">
  <meta name="twitter:description" content="JSON Schemas for the NoSocial protocol — Agent Profile and Interaction Report.">
  <meta name="twitter:image" content="${OG_IMAGE}">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='2' fill='%230a0a0a'/><text x='3' y='13' font-size='12' fill='%2300ff41'>▌</text></svg>">
  <link rel="stylesheet" href="${BASE}/style.css">
  ${posthog}
</head>
<body>
  <nav class="spec-nav">
    <a href="${BASE}/">← nosocial</a>
    <span>Schemas</span>
  </nav>
  <article class="spec-content">
    <h1>Schemas</h1>
    <p>JSON Schemas for the NoSocial protocol. All schemas are versioned independently and follow <a href="https://json-schema.org/draft/2020-12/schema">JSON Schema 2020-12</a>.</p>
${schemasIndex.map(s => `    <section class="schema-entry">
      <h2>${s.name} <span class="schema-version">v${s.version}</span></h2>
      <p>${s.description}</p>
      <ul class="schema-links">
        <li><a href="${BASE}/schemas/${s.slug}/${s.version}/schema.json">schema.json</a> — raw JSON Schema</li>
        <li><a href="${BASE}/extensions/agent-profile#${s.specAnchor}">spec section</a> — normative definition</li>
      </ul>
    </section>`).join('\n')}
  </article>
</body>
</html>`;

writeFileSync(join(DOCS, 'schemas', 'index.html'), schemasIndexHtml);

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
- \`GET /v1/agents/{did}\` — Full agent profile + reputation
- \`GET /v1/agents/{did}/reputation\` — Detailed reputation scores
- \`GET /v1/agents/search?capability=X&min_reputation=0.7\` — Discovery
- \`POST /v1/agents/challenge\` — Registration step 1 (request challenge)
- \`POST /v1/agents/register\` — Registration step 2 (signed challenge)
- \`POST /v1/reports\` — Submit signed interaction report
- \`GET /health\` — Health check

## Integrations

Agents can earn and consume reputation through published SDKs. Each wraps the oracle API with identity, auto-registration, and signed report submission.

- Vercel AI SDK — \`npm install @nosocial/ai-sdk\`. LanguageModelV1 middleware that auto-reports generations. Works with any provider (OpenAI, Anthropic, Google). Docs: https://github.com/pcdkd/nosocial-protocol/tree/main/integrations/ai-sdk
- LangGraph / LangChain — \`pip install nosocial-langgraph\`. BaseCallbackHandler that reports node completions, errors, tool calls, and retriever results. Docs: https://github.com/pcdkd/nosocial-protocol/tree/main/integrations/langgraph
- CrewAI — \`pip install nosocial-crewai\`. Task callback that auto-reports CrewAI task completions. Docs: https://github.com/pcdkd/nosocial-protocol/tree/main/integrations/crewai
- MCP Server (Claude, Cursor) — \`claude mcp add nosocial -- npx -y @nosocial/mcp-server\`. Exposes lookup, search, and reputation tools so agents and humans can query the oracle conversationally. Docs: https://github.com/pcdkd/nosocial-protocol/tree/main/mcp-server

## Core concepts

- Agent Profile — A2A Agent Card extension adding reputation, history, and evolution. Carried in the A2A \`extensions\` field or at \`/.well-known/nosocial.json\`.
- Identity — Ed25519 keypair. DID is \`did:nosocial:{SHA-256(publicKey)}\`. No blockchain.
- Interaction Reports — Signed attestations submitted by agents after collaborating. Both parties may report.
- Reputation domains — \`task_completion\`, \`reliability\`, \`information_quality\`, \`collaboration\`, \`communication\`. Time-decayed; reporter weight derived from the reporter's own reputation.

## Source

- [GitHub](https://github.com/pcdkd/nosocial-protocol)
- [Full specification in one fetch](${BASE}/llms-full.txt)
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
console.log('  nosocial-social-header.png');
console.log('  llms.txt');
console.log('  llms-full.txt');
console.log('  extensions/agent-profile/index.html');
console.log('  extensions/agent-profile/spec.md');
console.log('  schemas/index.html');
console.log('  schemas/agent-profile/0.1.0/schema.json');
console.log('  schemas/interaction-report/0.1.0/schema.json');
