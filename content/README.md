# content/

All the content of the site, as RDF. The `#` comments in the Turtle files are only a convenience: everything they say is here or in the data itself, so a tool that rewrites the files (and drops the comments) loses nothing.

| File | What it is |
|---|---|
| `portfolio.ttl` | The data: me, the paper, the projects, the notes, the About page. |
| `ontology.ttl` | The model, in RDFS/OWL: every class and property the data uses (the schema.org ones and the `site:` ones), with a label, what it does on the site (`rdfs:comment`), its `rdfs:domain` and `rdfs:range`. |
| `shapes.ttl` | SHACL shapes: which properties each kind of entry takes and needs. |
| `catalog-v001.xml` | `portfolio.ttl` imports the model (`owl:imports`); this file tells ontology editors to find it in `ontology.ttl`, so opening `portfolio.ttl` in Protégé shows the data and the model together. |

## What the build makes of it

`npm run build` (or `npm start` while developing) runs `scripts/build-content.mjs`, which reads `portfolio.ttl` and writes:

- `src/app/content/content.generated.ts`: the content of the pages
- `src/app/content/graph.generated.ts`: the two views of the Graph page (the ontology from `ontology.ttl`, the data from `portfolio.ttl`), laid out once at build time
- `public/data/portfolio.jsonld`: schema.org JSON-LD for search engines (without the `site:` terms)
- `public/data/portfolio.ttl`: the file itself, published at `/data/portfolio.ttl`

The output depends only on the graph, not on how the file is written: the order of statements, the formatting and the comments make no difference.

## Vocabulary

[schema.org](https://schema.org) for what it already describes, plus the `site:` namespace (`https://raphaffou.github.io/ns#`) for what only this site needs: order, URL slugs, case-study fields. Texts are in English; summaries are 2–3 sentences.

## Kinds of entries

| Type | Where it shows |
|---|---|
| `schema:Person` (exactly one) | Home page, About page, contact buttons |
| `schema:CollegeOrUniversity`, `schema:ResearchOrganization` | Context of a paper |
| `schema:DefinedTerm` | Topics: works point to them with `schema:about`; a project page links each topic to the Graph page |
| `schema:Role` | The position a paper was written in (Context on the Research page) |
| `schema:ScholarlyArticle` | Research page, and the Research section of the home page |
| `schema:SoftwareSourceCode` | Projects, in one of four sections of the Projects page (see below) |
| `schema:BlogPosting` | Notes. `schema:mentions` links a note to projects or papers: the note links to them, and they link back to it |
| `site:PathItem` | Path section of the About page, linked from me with `site:pathItem` |
| `site:SkillGroup` | Skills section of the About page, linked from me with `site:skillGroup` |

`shapes.ttl` lists, for each of them, the properties it takes and the ones it needs.

## Project fields

A project is in exactly one section of the Projects page:

| Section | How |
|---|---|
| Selected (home page too, and a page of its own) | `site:featured true` |
| Other projects | neither of the others (`site:featured false` or absent) |
| AI-assisted side projects | `site:aiAssisted true` (wins over `featured`) |
| Archive, closed by default | `site:archived true` (wins over both) |

| Field | Selected | The other sections |
|---|---|---|
| `schema:name`, `site:summary` | required | required |
| `site:context`: `site:Course`, `site:Work`, `site:Personal` (one or more) | required | required |
| `site:slug`, `site:problem`, `site:approach`, `site:result` | required | not shown |
| `site:order` | optional (last without it) | optional |
| `schema:dateCreated`, `site:stack` | optional | optional |
| `schema:codeRepository` | optional | optional ("no public code" without it) |
| `schema:url` (live demo), `site:role`, `site:label`, `schema:about` (topics) | optional | optional |

Boilerplate values start with `TODO`: replace them, or delete the line if the field is optional. A project or a note with a `TODO` left is a draft: the build leaves it out of the site, and the SHACL shapes list its `TODO`s as warnings.

## Order

RDF values have no order. Where the order matters (tools, skills, languages, interests, authors), the value is one text, items separated by semicolons: `"Python; pandas"`. (An RDF list would say it better, but OWL editors such as Protégé drop RDF lists when they save.) Entries (papers, projects, path items, skill groups) are ordered by `site:order`, smallest first; the path is newest first. Topics are sorted by name.

## Adding a note

```turtle
:homelab-1 a schema:BlogPosting ;
    site:slug "homelab-gpu-server" ;
    schema:headline "Building a GPU server from eight V100s" ;
    schema:datePublished "2026-11-02"^^xsd:date ;
    schema:about :llms ;
    schema:mentions :home-ai-infra ;
    site:summary "One or two sentences shown in the list." ;
    schema:articleBody """Paragraphs separated by a blank line.

Second paragraph.""" .
```

`schema:articleBody` is Markdown, GitHub flavour (read with [marked](https://marked.js.org)): titles (`#` becomes a section title, the note's own title being `schema:headline`), lists, tables, code blocks, quotes, links, and HTML for anything else (a `<video>`…). Images go in `public/images/`: `![What it shows](/images/rack.jpg)`, or `![What it shows](/images/rack.jpg "A caption")` for an image with a caption.

`schema:mentions` (optional, several allowed) points to projects or papers: the note ends with links to them, and each one links back to the note (on the project page, or under the paper on the Research page).

## Checking

- `npm run content`: what the build needs (syntax, required fields, unique slugs, declared topics).
- `pyshacl -s content/shapes.ttl content/portfolio.ttl`: the shapes, which also reject unknown properties (typos).

After saving from another tool, run both, and `git diff` to see what it changed: the generated files must stay the same.
