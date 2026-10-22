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
}

export interface Project {
  slug?: string;
  featured: boolean;
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
}

export interface Note {
  slug: string;
  headline: string;
  date: string;
  dateLabel: string;
  summary: string;
  html: string;
  topics: Topic[];
}

export interface Content {
  person: Person;
  papers: Paper[];
  projects: Project[];
  notes: Note[];
  topics: Topic[];
}

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
