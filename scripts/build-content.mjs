// Turns content/portfolio.ttl into everything the site needs:
//   src/app/content/content.generated.ts   typed content for the pages
//   src/app/content/graph.generated.ts     the two graphs of the Graph page, laid out (also reads
//                                          content/ontology.ttl and content/shapes.ttl)
//   public/data/portfolio.jsonld           schema.org JSON-LD (also inlined in the home page)
//   public/data/portfolio.ttl              the Turtle file itself, published as is (without drafts)
//
// Usage: node scripts/build-content.mjs [--watch]

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, watch } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser, Writer } from 'n3';
import { Marked } from 'marked';
import katex from 'katex';
import { forceSimulation, forceLink, forceManyBody, forceX, forceY } from 'd3-force';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'content/portfolio.ttl');
const ONTOLOGY = resolve(ROOT, 'content/ontology.ttl');
const SHAPES = resolve(ROOT, 'content/shapes.ttl');
const BASE = 'https://raphaffou.github.io/';
const SCHEMA = 'https://schema.org/';
const SITE = 'https://raphaffou.github.io/ns#';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL = 'http://www.w3.org/2002/07/owl#';
const SH = 'http://www.w3.org/ns/shacl#';

// site: properties the generator understands. Anything else is reported, to catch typos.
const KNOWN_SITE = new Set([
  'availability', 'cv', 'github', 'linkedin', 'bio', 'slug', 'order', 'featured', 'aiAssisted', 'archived', 'label',
  'venue', 'venueUrl', 'status', 'summary', 'problem', 'approach', 'result', 'role', 'stack', 'codeNote',
  'skillGroup', 'items', 'spokenLanguage', 'interest', 'pathItem', 'period', 'context',
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
  // Boilerplate values start with TODO. A project or a note that still has one is a draft: it is
  // left out of everything the build makes (pages, graph, JSON-LD, published Turtle) until it is filled in.
  const drafts = new Set(quads.filter((q) => q.object.termType === 'Literal' && q.object.value.startsWith('TODO')).map((q) => q.subject.value));
  for (const d of drafts) {
    const draftable = [SCHEMA + 'SoftwareSourceCode', SCHEMA + 'BlogPosting'];
    if (!quads.some((q) => q.subject.value === d && q.predicate.value === RDF + 'type' && draftable.includes(q.object.value))) {
      throw new ContentError(`<${d}> still has a TODO value (only projects and notes can be drafts)`);
    }
    console.warn(`draft: <${d}> still has TODO values and is left out of the site`);
  }
  quads = quads.filter((q) => !drafts.has(q.subject.value));
  const bySubject = new Map();
  for (const q of quads) {
    const k = q.subject.value;
    if (!bySubject.has(k)) bySubject.set(k, []);
    bySubject.get(k).push(q);
  }
  return { quads, bySubject, drafts };
}

function parseFile(file) {
  try {
    return new Parser({ baseIRI: BASE }).parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new ContentError(`${file.slice(ROOT.length + 1)} does not parse: ${e.message}`);
  }
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
  // Where the order matters, the value is one text, items separated by semicolons: "Python; pandas".
  // (RDF lists would say it better, but OWL editors such as Protégé drop them.)
  const textList = (s, p) => {
    const vs = values(s, p);
    if (vs.length > 1) throw new ContentError(`${short(s)}: ${name(p)} takes one text, items separated by semicolons`);
    return (vs[0] ?? '').split(';').map((v) => v.trim()).filter(Boolean);
  };
  const ofType = (type) =>
    [...bySubject.keys()].filter((s) => out(s, RDF + 'type').some((t) => t.value === type));
  return { out, all, values, value, number, bool, textList, ofType, local, short };
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
//  `code`, **bold**, *italic*, [text](url), ![alt](src), $math$
// ---------------------------------------------------------------------------

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Note bodies are Markdown (GitHub flavour: tables, task lists, HTML allowed), turned into HTML
// with the site's own link, image and code styles.
const md = new Marked({
  gfm: true,
  // $LaTeX$ becomes MathML at build time: browsers draw it natively, no script or font to ship.
  // As in Pandoc, "$" is not math when followed by a space, or when the closing one is followed
  // by a digit, so prices like "$5 and $10" stay text.
  extensions: [
    {
      name: 'math',
      level: 'inline',
      start: (src) => src.indexOf('$'),
      tokenizer(src) {
        const m = /^\$(?!\s)([^$\n]*?[^\s\\])\$(?!\d)/.exec(src);
        if (m) return { type: 'math', raw: m[0], tex: m[1] };
      },
      renderer: ({ tex }) => katex.renderToString(tex, { output: 'mathml', throwOnError: true }),
    },
  ],
  renderer: {
    // The page title is the h1: "# Title" in a note becomes an h2.
    heading({ tokens, depth }) {
      const h = Math.min(Math.max(depth, 2), 6);
      return `<h${h}>${this.parser.parseInline(tokens)}</h${h}>\n`;
    },
    link({ href, title, tokens }) {
      const t = title ? ` title="${esc(title)}"` : '';
      return `<a class="fx inline" href="${esc(href)}"${t}><span class="t">${this.parser.parseInline(tokens)}</span></a>`;
    },
    // ![alt](/images/x.png "caption"): with a title, the image becomes a figure with a caption.
    image({ href, title, text }) {
      const img = `<img src="${esc(href)}" alt="${esc(text)}" loading="lazy">`;
      return title ? `<figure>${img}<figcaption>${esc(title)}</figcaption></figure>` : img;
    },
    code({ text, lang }) {
      const l = lang ? ` data-lang="${esc(lang.split(/\s/)[0])}"` : '';
      return `<pre tabindex="0"${l}><code>${esc(text)}</code></pre>\n`;
    },
  },
});
// A figure alone in its paragraph is taken out of the <p>, where it is not allowed.
const markdown = (src = '') => md.parse(src.replace(/\r/g, '')).replace(/<p>(<figure>.*?<\/figure>)<\/p>/g, '$1');

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

  // RDF values have no order: topics are sorted by name, so the output does not
  // depend on how a tool happened to write the file.
  const byName = (a, b) => a.name.localeCompare(b.name);
  const topicIds = r.ofType(S('DefinedTerm'));
  const topicMap = new Map(topicIds.map((t) => [t, { id: r.local(t), name: r.value(t, S('name'), true) }]));
  const topicsOf = (s) =>
    r.all(s, S('about')).map((t) => {
      const topic = topicMap.get(t.value);
      if (!topic) throw new ContentError(`${r.short(s)} is about ${r.short(t.value)}, which is not declared as a schema:DefinedTerm`);
      return topic;
    }).sort(byName);
  const byOrder = (a, b) => r.number(a, T('order')) - r.number(b, T('order')) || a.localeCompare(b);

  // What a project was made for, shown before its date. A project can have several.
  const CONTEXTS = ['Work', 'Course', 'Personal'];
  const contextsOf = (s) => {
    const cs = r.all(s, T('context')).map((t) => r.local(t.value));
    if (!cs.length) throw new ContentError(`${r.short(s)} needs site:context (site:Course, site:Work or site:Personal)`);
    for (const c of cs) {
      if (!CONTEXTS.includes(c)) throw new ContentError(`${r.short(s)}: unknown context "${c}" (site:Course, site:Work or site:Personal)`);
    }
    return cs.sort((a, b) => CONTEXTS.indexOf(a) - CONTEXTS.indexOf(b));
  };

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
      items: r.textList(g, T('items')),
    })),
    languages: r.textList(me, T('spokenLanguage')),
    interests: r.textList(me, T('interest')),
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
    const authors = r.textList(s, S('author'));
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
      stack: r.textList(s, T('stack')),
      codeUrl: r.value(s, S('codeRepository')),
      codeNote: r.value(s, T('codeNote')),
      context,
      bibtex: bibtex({ title, authors, year: date.slice(0, 4), url }),
      topics: topicsOf(s),
      notes: [],
      _iri: s,
    };
  });

  const projects = r.ofType(S('SoftwareSourceCode')).sort(byOrder).map((s) => {
    const archived = r.bool(s, T('archived'));
    const featured = r.bool(s, T('featured')) && !archived;
    return {
      slug: slug(s, featured),
      featured,
      aiAssisted: r.bool(s, T('aiAssisted')),
      archived,
      contexts: contextsOf(s),
      name: r.value(s, S('name'), true),
      date: r.value(s, S('dateCreated')) ?? '',
      repo: r.value(s, S('codeRepository')),
      demo: r.value(s, S('url')),
      summary: r.value(s, T('summary'), true),
      problem: r.value(s, T('problem'), featured),
      approach: r.value(s, T('approach'), featured),
      result: r.value(s, T('result'), featured),
      role: r.value(s, T('role')),
      stack: r.textList(s, T('stack')),
      topics: topicsOf(s),
      notes: [],
      _iri: s,
    };
  });

  // What a note mentions, with a link to it; the note is listed back on that project or paper.
  const works = new Map([
    ...papers.map((p) => [p._iri, { work: p, name: p.title, link: '/research' }]),
    ...projects.map((p) => [p._iri, {
      work: p, name: p.name,
      link: p.featured && !p.aiAssisted ? `/projects/${p.slug}` : p.repo ?? '/projects',
    }]),
  ]);
  const mentionsOf = (s) =>
    r.all(s, S('mentions')).map((t) => {
      const w = works.get(t.value);
      if (!w) throw new ContentError(`${r.short(s)} mentions ${r.short(t.value)}, which is neither a project nor a paper`);
      return w;
    }).sort((a, b) => a.name.localeCompare(b.name));

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
        mentions: mentionsOf(s).map(({ name, link }) => ({ name, link })),
        _mentions: mentionsOf(s),
        _iri: s,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  for (const n of notes) for (const { work } of n._mentions) work.notes.push({ slug: n.slug, headline: n.headline });

  const topics = [...topicMap.values()].sort(byName);
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
  for (const s of [...described].sort()) {
    const node = { '@id': s, '@type': r.out(s, RDF + 'type').filter((t) => t.value.startsWith(SCHEMA)).map((t) => r.local(t.value)) };
    if (node['@type'].length === 1) node['@type'] = node['@type'][0];
    const preds = [...new Set(bySubject.get(s).map((q) => q.predicate.value))].filter((p) => p.startsWith(SCHEMA)).sort();
    for (const p of preds) {
      // Authors are one text, split here; several values of a property have no order, so they are sorted.
      const objects = r.out(s, p);
      const vals = p === SCHEMA + 'author'
        ? r.textList(s, p)
        : (objects.length === 1 ? r.all(s, p) : [...objects].sort((a, b) => a.value.localeCompare(b.value))).map(term);
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
//  Graph page: the ontology and the data as two graphs, laid out once, here,
//  with a force simulation. The page draws them and adds the switch between
//  them, zoom, pan and selection.
// ---------------------------------------------------------------------------

// Boxes include the label under the dot; this force pushes overlapping boxes apart.
function rectCollide(strength = 0.9) {
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
}

const round = (v) => Math.round(v * 10) / 10;

/** Positions nodes ({ id, r, w, h }) linked by edges ({ source, target }); returns the size and a map id → { x, y }. */
function layout(nodes, edges, { distance, charge, x = 0.05, y = 0.09 }) {
  const sim = forceSimulation(nodes)
    .force('link', forceLink(edges.map((e) => ({ ...e }))).id((n) => n.id).distance(distance).strength(0.6))
    .force('charge', forceManyBody().strength(charge))
    .force('x', forceX(0).strength(x))
    .force('y', forceY(0).strength(y))
    .force('box', rectCollide())
    .stop();
  for (let i = 0; i < 600; i++) sim.tick();
  const box = rectCollide(1);
  box.initialize(nodes);
  for (let i = 0; i < 80; i++) box();

  const pad = 24;
  const minX = Math.min(...nodes.map((n) => n.x - n.w / 2)) - pad;
  const minY = Math.min(...nodes.map((n) => n.y - n.r)) - pad;
  const maxX = Math.max(...nodes.map((n) => n.x + n.w / 2)) + pad;
  const maxY = Math.max(...nodes.map((n) => n.y - n.r + n.h)) + pad;
  return {
    width: Math.ceil(maxX - minX),
    height: Math.ceil(maxY - minY),
    pos: new Map(nodes.map((n) => [n.id, { x: round(n.x - minX), y: round(n.y - minY), r: n.r }])),
  };
}

/** Edge paths, from circle to circle; parallel edges are bent apart so their labels do not overlap. */
function edgePaths(edges, pos) {
  const groups = new Map();
  for (const e of edges) {
    const k = [e.source, e.target].sort().join(' ');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const onCircle = (p, q, rad) => {
    const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
    return { x: round(p.x + (dx / l) * rad), y: round(p.y + (dy / l) * rad) };
  };
  for (const group of groups.values()) group.forEach((e, i) => {
    const a = pos.get(e.source), b = pos.get(e.target);
    const sign = e.source < e.target ? 1 : -1;
    const bend = (i - (group.length - 1) / 2) * 30 * sign;
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    const c = { x: round((a.x + b.x) / 2 - (dy / l) * bend), y: round((a.y + b.y) / 2 + (dx / l) * bend) };
    const s = onCircle(a, c, a.r + 2), t = onCircle(b, c, b.r + 5);
    e.d = bend ? `M${s.x} ${s.y}Q${c.x} ${c.y} ${t.x} ${t.y}` : `M${s.x} ${s.y}L${t.x} ${t.y}`;
    e.lx = round(bend ? 0.25 * s.x + 0.5 * c.x + 0.25 * t.x : (s.x + t.x) / 2);
    e.ly = round(bend ? 0.25 * s.y + 0.5 * c.y + 0.25 * t.y : (s.y + t.y) / 2);
  });
  return edges;
}

const bySubjectOf = (quads) => {
  const m = new Map();
  for (const q of quads) {
    if (!m.has(q.subject.value)) m.set(q.subject.value, []);
    m.get(q.subject.value).push(q);
  }
  return { bySubject: m };
};

/** The two graphs of the Graph page: the classes of ontology.ttl, and the entries of portfolio.ttl. */
function buildRdfGraphs(r, data, ontQuads, shapeQuads) {
  const S = (p) => SCHEMA + p;
  const o = makeReader(bySubjectOf(ontQuads));
  const sh = makeReader(bySubjectOf(shapeQuads));
  const isIri = (v) => /^https?:\/\//.test(v);
  const label = (iri) => o.value(iri, RDFS + 'label') ?? o.local(iri);
  const compact = (iri) =>
    iri.startsWith(BASE + '#') ? ':' + iri.slice(BASE.length + 1)
      : iri.startsWith(SCHEMA) ? 'schema:' + iri.slice(SCHEMA.length)
        : iri.startsWith(SITE) ? 'site:' + iri.slice(SITE.length) : iri;
  // The four kinds that get a colour on the page; every other class is drawn in grey.
  const KIND = {
    [S('SoftwareSourceCode')]: 'project', [S('DefinedTerm')]: 'topic', [S('ScholarlyArticle')]: 'paper',
    [S('Organization')]: 'org', [S('CollegeOrUniversity')]: 'org', [S('ResearchOrganization')]: 'org', [S('Person')]: 'me',
  };
  const RANGE = { [XSD + 'string']: 'text', [XSD + 'integer']: 'number', [XSD + 'boolean']: 'true or false', [XSD + 'anyURI']: 'link', [SITE + 'Date']: 'date' };

  const classes = o.ofType(OWL + 'Class').filter(isIri);
  const classSet = new Set(classes);
  const objectProps = new Set(o.ofType(OWL + 'ObjectProperty').filter(isIri));
  const dataProps = o.ofType(OWL + 'DatatypeProperty').filter(isIri);

  // Which classes a property belongs to: its rdfs:domain (or the members of a union), else the
  // shapes that list it (schema.org properties have no domain here, the shapes say where they go).
  const shapeUse = new Map();
  for (const s of sh.ofType(SH + 'NodeShape')) {
    const targets = sh.all(s, SH + 'targetClass').map((t) => t.value);
    for (const ps of sh.out(s, SH + 'property')) {
      const path = sh.out(ps.value, SH + 'path')[0];
      if (path?.termType !== 'NamedNode') continue;
      if (!shapeUse.has(path.value)) shapeUse.set(path.value, new Set());
      for (const t of targets) shapeUse.get(path.value).add(t);
    }
  }
  const members = (t) => (t.termType === 'BlankNode' ? o.all(t.value, OWL + 'unionOf').map((m) => m.value) : [t.value]);
  const domainsOf = (p) => {
    const declared = o.out(p, RDFS + 'domain').flatMap(members);
    return (declared.length ? declared : [...(shapeUse.get(p) ?? [])]).filter((c) => classSet.has(c));
  };
  const byLabel = (a, b) => a.name.localeCompare(b.name);
  const box = (n, perChar) => ({ ...n, w: Math.round(Math.max(n.short.length * perChar, 2 * n.r) + 14), h: n.r * 2 + 26 });
  const readingOrder = (a, b) => Math.round(a.y / 70) - Math.round(b.y / 70) || a.x - b.x;

  // --- The ontology: classes, linked by the object properties between them and by subclass of.
  let nodes = classes.map((c) => box({
    id: o.local(c),
    iri: compact(c),
    label: label(c),
    short: label(c),
    classes: ['Class'],
    kind: KIND[c] ?? 'other',
    comment: o.value(c, RDFS + 'comment'),
    props: dataProps.filter((p) => domainsOf(p).includes(c))
      .map((p) => ({ name: label(p), value: RANGE[o.value(p, RDFS + 'range')] ?? 'value' })).sort(byLabel),
    r: 9,
  }, 8.6));
  let edges = [];
  for (const p of objectProps) {
    const ranges = o.out(p, RDFS + 'range').flatMap(members).filter((c) => classSet.has(c));
    for (const d of domainsOf(p)) for (const range of ranges) edges.push({ source: o.local(d), target: o.local(range), label: label(p) });
  }
  for (const c of classes) for (const sup of o.out(c, RDFS + 'subClassOf')) {
    if (classSet.has(sup.value)) edges.push({ source: o.local(c), target: o.local(sup.value), label: 'subclass of' });
  }
  edges.sort((a, b) => (a.source + a.target + a.label).localeCompare(b.source + b.target + b.label));
  let l = layout(nodes, edges, { distance: 170, charge: -1100, x: 0.07, y: 0.07 });
  const ontology = {
    width: l.width, height: l.height,
    nodes: nodes.map(({ x, y, vx, vy, index, ...n }) => ({ ...n, ...l.pos.get(n.id) })).sort(readingOrder),
    edges: edgePaths(edges, l.pos),
  };

  // --- The data: every entry of portfolio.ttl, and the model's own individuals it points to
  // (Course, Work, Personal), linked by the object properties of the ontology.
  const typesOf = (x) => [...r.out(x, RDF + 'type'), ...o.out(x, RDF + 'type')]
    .map((t) => t.value).filter((t) => classSet.has(t)).sort((a, b) => classes.indexOf(a) - classes.indexOf(b));
  const ids = new Set([...data.bySubject.keys()].filter((x) => isIri(x) && typesOf(x).length));
  for (const q of data.quads) {
    if (objectProps.has(q.predicate.value) && ids.has(q.subject.value) && typesOf(q.object.value).length) ids.add(q.object.value);
  }
  const pageOf = (x, types) => {
    const is = (c) => types.includes(c);
    if (is(S('Person'))) return '/about';
    if (is(S('ScholarlyArticle'))) return '/research';
    if (is(S('SoftwareSourceCode'))) {
      const slug = r.value(x, SITE + 'slug');
      const page = r.bool(x, SITE + 'featured') && !r.bool(x, SITE + 'aiAssisted') && !r.bool(x, SITE + 'archived') && slug;
      return page ? `/projects/${slug}` : '/projects';
    }
    if (is(S('BlogPosting'))) return `/notes/${r.value(x, SITE + 'slug')}`;
    if (is(SITE + 'PathItem') || is(SITE + 'SkillGroup')) return '/about';
    if (is(SITE + 'ProjectContext')) return '/projects';
    return undefined;
  };
  const shorten = (t, n = 26) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);
  nodes = [...ids].map((x) => {
    const types = typesOf(x);
    const name = r.value(x, S('name')) ?? r.value(x, S('headline')) ?? o.value(x, RDFS + 'label') ?? r.local(x);
    const kind = types.map((t) => KIND[t]).find(Boolean) ?? 'other';
    return box({
      id: r.local(x),
      iri: compact(x),
      label: name,
      short: shorten(r.value(x, SITE + 'label') ?? name),
      classes: types.map(label),
      kind,
      comment: o.value(x, RDFS + 'comment'),
      props: dataProps.flatMap((p) => r.out(x, p).map((v) => {
        const isLink = o.value(p, RDFS + 'range') === XSD + 'anyURI';
        return isLink ? { name: label(p), value: v.value, link: href(v.value) } : { name: label(p), value: v.value };
      })),
      href: pageOf(x, types),
      r: kind === 'me' ? 8 : kind === 'topic' ? 6 : 5,
    }, 7.2);
  });
  edges = data.quads
    .filter((q) => objectProps.has(q.predicate.value) && ids.has(q.subject.value) && ids.has(q.object.value))
    .map((q) => ({ source: r.local(q.subject.value), target: r.local(q.object.value), label: label(q.predicate.value) }))
    .sort((a, b) => (a.source + a.target + a.label).localeCompare(b.source + b.target + b.label));
  l = layout(nodes, edges, { distance: 90, charge: -600, x: 0.13, y: 0.1 });
  const dataGraph = {
    width: l.width, height: l.height,
    nodes: nodes.map(({ x, y, vx, vy, index, ...n }) => ({ ...n, ...l.pos.get(n.id) })).sort(readingOrder),
    edges: edgePaths(edges, l.pos),
  };
  return { ontology, data: dataGraph };
}

// The previous Graph page: topics as hubs, linked to the papers, projects and notes about
// them. Not used any more; kept in case it comes back (its template is commented out at the
// end of src/app/pages/graph.html). To bring it back, write buildTopicGraph(r, c) to
// graph.generated.ts in run().
function buildTopicGraph(r, c) {
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
  for (const p of c.projects.filter((p) => !p.aiAssisted)) { // kept apart from the rest, as on the Projects page
    const label = r.value(p._iri, SITE + 'label') ?? p.name;
    if (p.featured) work('w-' + p.slug, label, 'project', `/projects/${p.slug}`, false, p.topics);
    else if (p.repo) work('w-' + r.local(p._iri), label, 'project', p.repo, true, p.topics);
  }
  for (const n of c.notes) work('n-' + n.slug, n.headline, 'note', `/notes/${n.slug}`, false, n.topics);

  // Drop topics nobody points to; link me to every remaining topic, so the graph is connected.
  const used = new Set(edges.flatMap((e) => [e.source, e.target]));
  const kept = nodes.filter((n) => n.kind !== 'topic' || used.has(n.id));
  for (const n of kept) if (n.kind === 'topic') edges.push({ source: 'me', target: n.id });
  for (const n of kept) {
    n.w = Math.max(width(n.label, n.kind), 2 * n.r) + 14;
    n.h = n.r * 2 + 26;
  }
  const keptEdges = edges.filter((e) => kept.some((n) => n.id === e.target));
  const { width: w, height: h, pos } = layout(kept, keptEdges, { distance: (e) => (e.source.id === 'me' ? 120 : 95), charge: -420 });
  return {
    width: w,
    height: h,
    // Reading order (rows of ~70 px, then left to right) is also the keyboard order.
    nodes: kept
      .map(({ id, label, kind, href, external, r: rad, w, h }) => ({ id, label, kind, href, external, r: rad, w: Math.round(w), h: Math.round(h), x: pos.get(id).x, y: pos.get(id).y }))
      .sort((a, b) => Math.round(a.y / 70) - Math.round(b.y / 70) || a.x - b.x),
    edges: keptEdges.map((e) => ({ ...e, x1: pos.get(e.source).x, y1: pos.get(e.source).y, x2: pos.get(e.target).x, y2: pos.get(e.target).y })),
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
  const graphs = buildRdfGraphs(r, data, parseFile(ONTOLOGY), parseFile(SHAPES));
  const jsonld = buildJsonLd(r, data);

  mkdirSync(resolve(ROOT, 'src/app/content'), { recursive: true });
  mkdirSync(resolve(ROOT, 'public/data'), { recursive: true });
  writeIfChanged('src/app/content/content.generated.ts',
    `${HEADER}import type { Content } from './content.model';\n\nexport const content: Content = ${JSON.stringify(content, null, 2)};\n`);
  writeIfChanged('src/app/content/graph.generated.ts',
    `${HEADER}import type { RdfGraph } from './content.model';\n\n` +
    `export const ontologyGraph: RdfGraph = ${JSON.stringify(graphs.ontology)};\n\n` +
    `export const dataGraph: RdfGraph = ${JSON.stringify(graphs.data)};\n`);
  writeIfChanged('public/data/portfolio.jsonld', JSON.stringify(jsonld, null, 2) + '\n');
  if (data.drafts.size) {
    const writer = new Writer({ prefixes: { '': BASE + '#', schema: SCHEMA, site: SITE, xsd: XSD } });
    writer.addQuads(data.quads);
    writer.end((e, text) => writeIfChanged('public/data/portfolio.ttl', text));
  } else {
    copyFileSync(SRC, resolve(ROOT, 'public/data/portfolio.ttl'));
  }
  console.log(
    `content: ${data.quads.length} triples → ${c.papers.length} paper(s), ${c.projects.length} projects ` +
    `(${c.projects.filter((p) => p.featured).length} featured), ${c.notes.length} note(s), ` +
    `graph: ontology ${graphs.ontology.nodes.length} classes, data ${graphs.data.nodes.length} nodes / ${graphs.data.edges.length} links (${Date.now() - t0} ms)`,
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
  for (const file of [SRC, ONTOLOGY, SHAPES]) {
    watch(file, () => {
      clearTimeout(timer);
      timer = setTimeout(safeRun, 100);
    });
  }
  console.log('watching content/portfolio.ttl, ontology.ttl and shapes.ttl');
} else if (!safeRun()) {
  process.exit(1);
}
