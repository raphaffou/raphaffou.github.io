// Shapes of the content generated from content/portfolio.ttl.
// The data itself lives in content.generated.ts and graph.generated.ts,
// both written by scripts/build-content.mjs: edit the Turtle file, not them.

export interface Topic {
  id: string;
  name: string;
}

export interface PathItem {
  period: string;
  name: string;
  description: string;
}

export interface SkillGroup {
  name: string;
  items: string[];
}

export interface Person {
  name: string;
  jobTitle: string;
  description: string;
  email: string;
  address: string;
  availability: string;
  cv: string;
  github: string;
  linkedin: string;
  bio: string[];
  path: PathItem[];
  skills: SkillGroup[];
  languages: string[];
  interests: string[];
}

/** A note, as listed on the project or paper it mentions. */
export interface NoteRef {
  slug: string;
  headline: string;
}

export interface Paper {
  slug: string;
  title: string;
  authors: string[];
  date: string;
  dateLabel: string;
  year: string;
  url: string;
  status: string;
  venue?: string;
  venueUrl?: string;
  arxiv?: string;
  summary: string;
  problem: string;
  approach: string;
  result: string;
  stack: string[];
  codeUrl?: string;
  codeNote?: string;
  context?: { name: string; org: string; place?: string; description?: string };
  bibtex: string;
  topics: Topic[];
  notes: NoteRef[];
}

export interface Project {
  slug?: string;
  featured: boolean;
  /** Written mostly with an AI coding agent: listed on its own, never featured. */
  aiAssisted: boolean;
  /** Kept for the record: in the Archive, closed by default (wins over featured and aiAssisted). */
  archived: boolean;
  /** What it was made for: "Work", "Course" and/or "Personal", in that order. */
  contexts: string[];
  name: string;
  date: string;
  repo?: string;
  demo?: string;
  summary: string;
  problem?: string;
  approach?: string;
  result?: string;
  role?: string;
  stack: string[];
  topics: Topic[];
  notes: NoteRef[];
}

export interface Note {
  slug: string;
  headline: string;
  date: string;
  dateLabel: string;
  summary: string;
  html: string;
  topics: Topic[];
  /** The projects and papers it mentions; a link starting with / is a page of this site. */
  mentions: { name: string; link: string }[];
}

export interface Content {
  person: Person;
  papers: Paper[];
  projects: Project[];
  notes: Note[];
  topics: Topic[];
}

/** The four kinds drawn in colour on the Graph page; every other class is grey. */
export type RdfKind = 'project' | 'topic' | 'paper' | 'org' | 'me' | 'other';

/** A class (ontology view) or an entry (data view) of the Graph page. */
export interface RdfNode {
  id: string;
  /** Prefixed IRI, e.g. ":rent-prediction" or "schema:SoftwareSourceCode". */
  iri: string;
  label: string;
  /** The label drawn on the graph, cut at 26 characters. */
  short: string;
  /** Class labels of an entry; ["Class"] for a class. */
  classes: string[];
  kind: RdfKind;
  comment?: string;
  /** Literal values of an entry, or the datatype properties of a class with their type. */
  props: { name: string; value: string; link?: string }[];
  /** Its page on this site, if it has one. */
  href?: string;
  x: number;
  y: number;
  r: number;
  w: number;
  h: number;
}

export interface RdfEdge {
  source: string;
  target: string;
  /** The property, by its label. */
  label: string;
  /** SVG path from circle to circle, and where its label goes. */
  d: string;
  lx: number;
  ly: number;
}

export interface RdfGraph {
  width: number;
  height: number;
  nodes: RdfNode[];
  edges: RdfEdge[];
}

// The previous Graph page (topics as hubs), not used any more: see buildTopicGraph in
// scripts/build-content.mjs.
export type GraphKind = 'person' | 'topic' | 'paper' | 'project' | 'note';

export interface GraphNode {
  id: string;
  label: string;
  kind: GraphKind;
  x: number;
  y: number;
  r: number;
  /** Size of the box around the dot and its label (for focus rings and collisions). */
  w: number;
  h: number;
  href: string;
  external: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Graph {
  width: number;
  height: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
