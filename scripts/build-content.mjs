// Turns content/portfolio.ttl into everything the site needs:
//   src/app/content/content.generated.ts   typed content for the pages
//   src/app/content/graph.generated.ts     precomputed layout of the Graph page
//   public/data/portfolio.jsonld           schema.org JSON-LD (also inlined in the home page)
//   public/data/portfolio.ttl              the Turtle file itself, published as is
//
// Usage: node scripts/build-content.mjs [--watch]

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, watch } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser } from 'n3';
import { forceSimulation, forceLink, forceManyBody, forceX, forceY } from 'd3-force';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'content/portfolio.ttl');
const BASE = 'https://raphaffou.github.io/';
const SCHEMA = 'https://schema.org/';
const SITE = 'https://raphaffou.github.io/ns#';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

// site: properties the generator understands. Anything else is reported, to catch typos.
const KNOWN_SITE = new Set([
  'availability', 'cv', 'github', 'linkedin', 'bio', 'slug', 'order', 'featured', 'label',
  'venue', 'venueUrl', 'status', 'summary', 'problem', 'approach', 'result', 'role', 'stack', 'codeNote',
  'skillGroup', 'items', 'spokenLanguage', 'interest', 'pathItem', 'period',
]);

class ContentError extends Error {}

// ---------------------------------------------------------------------------
//  Reading the graph, keeping the order in which values are written
// ---------------------------------------------------------------------------

function load() {
  let quads;
  try {
    quads = new Parser({ baseIRI: BASE }).parse(readFileSync(SRC, 'utf8'));
  } catch (e) {
    throw new ContentError(`portfolio.ttl does not parse: ${e.message}`);
  }
  const bySubject = new Map();
  for (const q of quads) {
    const k = q.subject.value;
    if (!bySubject.has(k)) bySubject.set(k, []);
    bySubject.get(k).push(q);
  }
  return { quads, bySubject };
}

function makeReader({ bySubject }) {
  const out = (s, p) => (bySubject.get(s) ?? []).filter((q) => q.predicate.value === p).map((q) => q.object);

  // RDF collections ( "a" "b" ) come out as rdf:first / rdf:rest chains.
  const list = (term) => {
    const items = [];
    let node = term;
    while (node && node.value !== RDF + 'nil') {
      const first = out(node.value, RDF + 'first')[0];
      if (!first) return [term];
      items.push(first);
      node = out(node.value, RDF + 'rest')[0];
    }
    return items;
  };
  const all = (s, p) => out(s, p).flatMap((t) => (t.termType === 'BlankNode' ? list(t) : [t]));
  const local = (iri) => iri.replace(/^.*[#/]/, '');
  const short = (s) => (s.startsWith(BASE + '#') ? ':' + local(s) : `<${s}>`);
  const name = (p) => (p.startsWith(SCHEMA) ? 'schema:' : p.startsWith(SITE) ? 'site:' : '') + local(p);

  const values = (s, p) => all(s, p).map((t) => href(t.value));
  const value = (s, p, required = false) => {
    const v = values(s, p)[0];
    if (required && (v === undefined || v === '')) throw new ContentError(`${short(s)} needs ${name(p)}`);
    return v;
  };
  const number = (s, p) => {
    const v = value(s, p);
    return v === undefined ? 999 : Number(v);
  };
  const bool = (s, p) => value(s, p) === 'true';
  const ofType = (type) =>
    [...bySubject.keys()].filter((s) => out(s, RDF + 'type').some((t) => t.value === type));
  return { out, all, values, value, number, bool, ofType, local, short };
}

// Links inside the site become root-relative paths ("/cv/…").
function href(v) {
  return v.startsWith(BASE) && !v.startsWith(BASE + '#') && !v.startsWith(BASE + 'ns#') ? '/' + v.slice(BASE.length) : v;
}

const paragraphs = (text = '') =>
  text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function dateLabel(d = '') {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(d);
  if (!m) return d;
  if (m[3]) return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  if (m[2]) return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  return m[1];
}

// ---------------------------------------------------------------------------
//  A deliberately small Markdown, for notes
//  ## heading, ### heading, paragraphs, - lists, 1. lists, ``` code ```, > quote,
//  `code`, **bold**, *italic*, [text](url), ![alt](src)
// ---------------------------------------------------------------------------

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function inline(text) {
  const codes = [];
  let s = esc(text).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = s
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img src="${src}" alt="${alt}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a class="fx inline" href="${u}"><span class="t">${t}</span></a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}
function markdown(src = '') {
  const lines = src.replace(/\r/g, '').split('\n');
  const html = [];
  let para = [];
  let list = null;
  const flush = () => {
    if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
    if (list) html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^```\s*([\w-]*)/.exec(line);
    if (fence) {
      flush();
      const code = [];
      while (++i < lines.length && !/^```/.test(lines[i])) code.push(lines[i]);
      const lang = fence[1] ? ` data-lang="${fence[1]}"` : '';
      html.push(`<pre tabindex="0"${lang}><code>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }
    let m;
    if ((m = /^(#{2,3})\s+(.*)/.exec(line))) {
      flush();
      html.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
    } else if ((m = /^\s*(?:([-*])|(\d+)\.)\s+(.*)/.exec(line))) {
      if (para.length) { html.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
      const tag = m[1] ? 'ul' : 'ol';
      if (!list || list.tag !== tag) { flush(); list = { tag, items: [] }; }
      list.items.push(m[3]);
    } else if ((m = /^>\s?(.*)/.exec(line))) {
      flush();
      html.push(`<blockquote><p>${inline(m[1])}</p></blockquote>`);
    } else if (!line.trim()) {
      flush();
    } else if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ' ' + line.trim();
    } else {
      if (list) flush();
      para.push(line.trim());
    }
  }
  flush();
  return html.join('\n');
}

// ---------------------------------------------------------------------------
//  Content
// ---------------------------------------------------------------------------

function buildContent(r, quads) {
  const S = (p) => SCHEMA + p;
  const T = (p) => SITE + p;

  for (const q of quads) {
    const p = q.predicate.value;
    if (p.startsWith(SITE) && !KNOWN_SITE.has(p.slice(SITE.length))) {
      console.warn(`warning: unknown property site:${p.slice(SITE.length)} on ${r.short(q.subject.value)} (ignored)`);
    }
  }

  const topicIds = r.ofType(S('DefinedTerm'));
  const topicMap = new Map(topicIds.map((t) => [t, { id: r.local(t), name: r.value(t, S('name'), true) }]));
  const topicsOf = (s) =>
    r.all(s, S('about')).map((t) => {
      const topic = topicMap.get(t.value);
      if (!topic) throw new ContentError(`${r.short(s)} is about ${r.short(t.value)}, which is not declared as a schema:DefinedTerm`);
      return topic;
    });
  const byOrder = (a, b) => r.number(a, T('order')) - r.number(b, T('order'));

  const people = r.ofType(S('Person'));
  if (people.length !== 1) throw new ContentError(`expected exactly one schema:Person, found ${people.length}`);
  const me = people[0];
  const person = {
    name: r.value(me, S('name'), true),
    jobTitle: r.value(me, S('jobTitle'), true),
    description: r.value(me, S('description'), true),
    email: r.value(me, S('email'), true),
    address: r.value(me, S('address')) ?? '',
    availability: r.value(me, T('availability')) ?? '',
    cv: r.value(me, T('cv')) ?? '',
    github: r.value(me, T('github')) ?? '',
    linkedin: r.value(me, T('linkedin')) ?? '',
    bio: paragraphs(r.value(me, T('bio'))),
    path: r.all(me, T('pathItem')).map((t) => t.value).sort(byOrder).map((s) => ({
      period: r.value(s, T('period'), true),
      name: r.value(s, S('name'), true),
      description: r.value(s, S('description')) ?? '',
    })),
    skills: r.all(me, T('skillGroup')).map((t) => t.value).sort(byOrder).map((g) => ({
      name: r.value(g, S('name'), true),
      items: r.values(g, T('items')),
    })),
    languages: r.values(me, T('spokenLanguage')),
    interests: r.values(me, T('interest')),
  };

  const slugs = new Set();
  const slug = (s, required) => {
    const v = r.value(s, T('slug'), required);
    if (v === undefined) return undefined;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)) throw new ContentError(`${r.short(s)}: slug "${v}" must be lowercase letters, digits and dashes`);
    if (slugs.has(v)) throw new ContentError(`slug "${v}" is used twice`);
    slugs.add(v);
    return v;
  };

  const papers = r.ofType(S('ScholarlyArticle')).sort(byOrder).map((s) => {
    const authors = r.values(s, S('author'));
    const date = r.value(s, S('datePublished'), true);
    const url = r.value(s, S('url'), true);
    const roleIri = r.all(s, S('isPartOf'))[0]?.value;
    const context = roleIri && r.value(roleIri, S('name'))
      ? (() => {
          const orgIri = r.all(roleIri, S('memberOf'))[0]?.value;
          return {
            name: r.value(roleIri, S('name')),
            org: (orgIri && r.value(orgIri, S('name'))) ?? '',
            place: orgIri ? r.value(orgIri, S('address')) : undefined,
            description: r.value(roleIri, S('description')),
          };
        })()
      : undefined;
    const title = r.value(s, S('name'), true);
    return {
      slug: slug(s, true),
      title,
      authors,
      date,
      dateLabel: dateLabel(date),
      year: date.slice(0, 4),
      url,
      status: r.value(s, T('status')) ?? '',
      venue: r.value(s, T('venue')),
      arxiv: /arxiv\.org\/abs\/([^\s/?#]+)/.exec(url)?.[1],
      venueUrl: r.value(s, T('venueUrl')),
      summary: r.value(s, T('summary'), true),
      problem: r.value(s, T('problem'), true),
      approach: r.value(s, T('approach'), true),
      result: r.value(s, T('result'), true),
      stack: r.values(s, T('stack')),
      codeUrl: r.value(s, S('codeRepository')),
      codeNote: r.value(s, T('codeNote')),
      context,
      bibtex: bibtex({ title, authors, year: date.slice(0, 4), url }),
      topics: topicsOf(s),
    };
  });

  const projects = r.ofType(S('SoftwareSourceCode')).sort(byOrder).map((s) => {
    const featured = r.bool(s, T('featured'));
    return {
      slug: slug(s, featured),
      featured,
      name: r.value(s, S('name'), true),
      date: r.value(s, S('dateCreated')) ?? '',
      repo: r.value(s, S('codeRepository')),
      demo: r.value(s, S('url')),
      summary: r.value(s, T('summary'), true),
      problem: r.value(s, T('problem'), featured),
      approach: r.value(s, T('approach'), featured),
      result: r.value(s, T('result'), featured),
      role: r.value(s, T('role')),
      stack: r.values(s, T('stack')),
      topics: topicsOf(s),
      _iri: s,
    };
  });

  const notes = r.ofType(S('BlogPosting'))
    .map((s) => {
      const date = r.value(s, S('datePublished'), true);
      return {
        slug: slug(s, true),
        headline: r.value(s, S('headline'), true),
        date,
        dateLabel: dateLabel(date),
        summary: r.value(s, T('summary')) ?? '',
        html: markdown(r.value(s, S('articleBody')) ?? ''),
        topics: topicsOf(s),
        _iri: s,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const topics = [...topicMap.values()];
  return { person, papers, projects, notes, topics, me };
}

function bibtex({ title, authors, year, url }) {
  const last = (n) => n.trim().split(/\s+/).pop();
  const first = (n) => n.trim().split(/\s+/).slice(0, -1).join(' ');
  const ascii = (s) => s.normalize('NFD').replace(/[^\w]/g, '').toLowerCase();
  const word = title.split(/\s+/).map(ascii).find((w) => w.length > 3 && !['with', 'from', 'that', 'this'].includes(w)) ?? 'paper';
  const key = `${ascii(last(authors[0] ?? 'anon'))}${year}${word}`;
  const arxiv = /arxiv\.org\/abs\/([^\s/?#]+)/.exec(url)?.[1];
  const braced = title.replace(/\b([A-Z]{2,}s?)\b/g, '{$1}');
  const fields = [
    ['title', `{${braced}}`],
    ['author', `{${authors.map((a) => `${last(a)}, ${first(a)}`).join(' and ')}}`],
    ['year', `{${year}}`],
    ...(arxiv ? [['eprint', `{${arxiv}}`], ['archivePrefix', '{arXiv}']] : []),
    ['url', `{${url}}`],
  ];
  const w = Math.max(...fields.map(([k]) => k.length));
  return `@misc{${key},\n${fields.map(([k, v]) => `  ${k.padEnd(w)} = ${v}`).join(',\n')}\n}`;
}

// ---------------------------------------------------------------------------
//  JSON-LD (schema.org only; site: properties are left out)
// ---------------------------------------------------------------------------

function buildJsonLd(r, { bySubject }) {
  const described = new Set(
    [...bySubject.keys()].filter((s) => r.out(s, RDF + 'type').some((t) => t.value.startsWith(SCHEMA))),
  );
  const term = (t) => {
    if (t.termType === 'NamedNode') return described.has(t.value) ? { '@id': t.value } : t.value.startsWith(BASE) ? BASE + href(t.value).slice(1) : t.value;
    if (t.termType === 'Literal') {
      const dt = t.datatype?.value;
      if (dt === XSD + 'integer' || dt === XSD + 'decimal') return Number(t.value);
      if (dt === XSD + 'boolean') return t.value === 'true';
      return t.value;
    }
    return t.value;
  };
  const graph = [];
  for (const s of described) {
    const node = { '@id': s, '@type': r.out(s, RDF + 'type').filter((t) => t.value.startsWith(SCHEMA)).map((t) => r.local(t.value)) };
    if (node['@type'].length === 1) node['@type'] = node['@type'][0];
    const preds = [...new Set(bySubject.get(s).map((q) => q.predicate.value))].filter((p) => p.startsWith(SCHEMA));
    for (const p of preds) {
      const vals = r.all(s, p).map(term);
      node[r.local(p)] = vals.length === 1 ? vals[0] : vals;
    }
    const slug = r.value(s, SITE + 'slug');
    const types = [node['@type']].flat();
    if (slug && types.includes('SoftwareSourceCode')) node.mainEntityOfPage = `${BASE}projects/${slug}/`;
    if (slug && types.includes('ScholarlyArticle')) node.mainEntityOfPage = `${BASE}research/`;
    if (slug && types.includes('BlogPosting')) node.url = `${BASE}notes/${slug}/`;
    graph.push(node);
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

// ---------------------------------------------------------------------------
//  Graph page: force layout computed once, here, so the page needs no script
// ---------------------------------------------------------------------------

function buildGraph(r, c) {
  const S = (p) => SCHEMA + p;
  const nodes = [];
  const edges = [];
  const add = (n) => nodes.push(n);
  // Approximate text widths (px) for the fonts used on the page.
  const width = (label, kind) => label.length * (kind === 'topic' ? 9.6 : 7.4);

  add({ id: 'me', label: c.person.name, kind: 'person', href: '/about', external: false, r: 7 });
  for (const t of c.topics) add({ id: 't-' + t.id, label: t.name, kind: 'topic', href: `/graph#topic-${t.id}`, external: false, r: 5 });

  const work = (id, label, kind, href, external, topics) => {
    if (!topics.length) return;
    add({ id, label, kind, href, external, r: 4 });
    for (const t of topics) edges.push({ source: id, target: 't-' + t.id });
  };
  for (const p of c.papers) {
    const iri = r.ofType(S('ScholarlyArticle')).find((s) => r.value(s, SITE + 'slug') === p.slug);
    work('p-' + p.slug, r.value(iri, SITE + 'label') ?? p.title, 'paper', '/research', false, p.topics);
  }
  for (const p of c.projects) {
    const label = r.value(p._iri, SITE + 'label') ?? p.name;
    if (p.featured) work('w-' + p.slug, label, 'project', `/projects/${p.slug}`, false, p.topics);
    else if (p.repo) work('w-' + r.local(p._iri), label, 'project', p.repo, true, p.topics);
  }
  for (const n of c.notes) work('n-' + n.slug, n.headline, 'note', `/notes/${n.slug}`, false, n.topics);

  // Drop topics nobody points to; link me to every remaining topic, so the graph is connected.
  const used = new Set(edges.flatMap((e) => [e.source, e.target]));
  const kept = nodes.filter((n) => n.kind !== 'topic' || used.has(n.id));
  for (const n of kept) if (n.kind === 'topic') edges.push({ source: 'me', target: n.id });

  // Boxes include the label, which sits under the dot.
  for (const n of kept) {
    n.w = Math.max(width(n.label, n.kind), 2 * n.r) + 14;
    n.h = n.r * 2 + 26;
  }
  const rectCollide = (strength = 0.9) => {
    let ns;
    const force = () => {
      for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i], b = ns[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const ox = (a.w + b.w) / 2 - Math.abs(dx), oy = (a.h + b.h) / 2 - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (ox / a.w < oy / a.h) { const m = (ox / 2) * strength * Math.sign(dx || 1); a.x -= m; b.x += m; }
          else { const m = (oy / 2) * strength * Math.sign(dy || 1); a.y -= m; b.y += m; }
        }
      }
    };
    force.initialize = (n) => (ns = n);
    return force;
  };
  const sim = forceSimulation(kept)
    .force('link', forceLink(edges.filter((e) => kept.some((n) => n.id === e.target))).id((n) => n.id).distance((e) => (e.source.id === 'me' ? 120 : 95)).strength(0.6))
    .force('charge', forceManyBody().strength(-420))
    .force('x', forceX(0).strength(0.05))
    .force('y', forceY(0).strength(0.09))
    .force('box', rectCollide())
    .stop();
  for (let i = 0; i < 600; i++) sim.tick();
  const box = rectCollide(1);
  box.initialize(kept);
  for (let i = 0; i < 80; i++) box();

  const pad = 24;
  const minX = Math.min(...kept.map((n) => n.x - n.w / 2)) - pad;
  const minY = Math.min(...kept.map((n) => n.y - n.r)) - pad;
  const maxX = Math.max(...kept.map((n) => n.x + n.w / 2)) + pad;
  const maxY = Math.max(...kept.map((n) => n.y - n.r + n.h)) + pad;
  const round = (v) => Math.round(v * 10) / 10;
  const pos = new Map(kept.map((n) => [n.id, { x: round(n.x - minX), y: round(n.y - minY) }]));
  return {
    width: Math.ceil(maxX - minX),
    height: Math.ceil(maxY - minY),
    // Reading order (rows of ~70 px, then left to right) is also the keyboard order.
    nodes: kept
      .map(({ id, label, kind, href, external, r: rad, w, h }) => ({ id, label, kind, href, external, r: rad, w: Math.round(w), h: Math.round(h), ...pos.get(id) }))
      .sort((a, b) => Math.round(a.y / 70) - Math.round(b.y / 70) || a.x - b.x),
    edges: edges
      .map((e) => ({ source: e.source.id ?? e.source, target: e.target.id ?? e.target }))
      .filter((e) => pos.has(e.source) && pos.has(e.target))
      .map((e) => ({ ...e, x1: pos.get(e.source).x, y1: pos.get(e.source).y, x2: pos.get(e.target).x, y2: pos.get(e.target).y })),
  };
}

// ---------------------------------------------------------------------------

const HEADER = '// GENERATED by scripts/build-content.mjs from content/portfolio.ttl. Do not edit: edit the Turtle file.\n';
const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k.startsWith('_') ? undefined : v)));

function run() {
  const t0 = Date.now();
  const data = load();
  const r = makeReader(data);
  const c = buildContent(r, data.quads);
  const content = strip({ person: c.person, papers: c.papers, projects: c.projects, notes: c.notes, topics: c.topics });
  const graph = buildGraph(r, c);
  const jsonld = buildJsonLd(r, data);

  mkdirSync(resolve(ROOT, 'src/app/content'), { recursive: true });
  mkdirSync(resolve(ROOT, 'public/data'), { recursive: true });
  writeIfChanged('src/app/content/content.generated.ts',
    `${HEADER}import type { Content } from './content.model';\n\nexport const content: Content = ${JSON.stringify(content, null, 2)};\n`);
  writeIfChanged('src/app/content/graph.generated.ts',
    `${HEADER}import type { Graph } from './content.model';\n\nexport const graph: Graph = ${JSON.stringify(graph)};\n`);
  writeIfChanged('public/data/portfolio.jsonld', JSON.stringify(jsonld, null, 2) + '\n');
  copyFileSync(SRC, resolve(ROOT, 'public/data/portfolio.ttl'));
  console.log(
    `content: ${data.quads.length} triples → ${c.papers.length} paper(s), ${c.projects.length} projects ` +
    `(${c.projects.filter((p) => p.featured).length} featured), ${c.notes.length} note(s), ` +
    `graph ${graph.nodes.length} nodes / ${graph.edges.length} edges (${Date.now() - t0} ms)`,
  );
}

function writeIfChanged(rel, text) {
  const file = resolve(ROOT, rel);
  let old = null;
  try { old = readFileSync(file, 'utf8'); } catch {}
  if (old !== text) writeFileSync(file, text);
}

function safeRun() {
  try {
    run();
    return true;
  } catch (e) {
    if (e instanceof ContentError) console.error(`\ncontent error: ${e.message}\n`);
    else console.error(e);
    return false;
  }
}

if (process.argv.includes('--watch')) {
  safeRun();
  let timer;
  watch(SRC, () => {
    clearTimeout(timer);
    timer = setTimeout(safeRun, 100);
  });
  console.log('watching content/portfolio.ttl');
} else if (!safeRun()) {
  process.exit(1);
}
