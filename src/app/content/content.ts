// Read-only access to the generated content, with a few helpers for the pages.
import { content } from './content.generated';
import { graph } from './graph.generated';
import type { Note, Paper, Project } from './content.model';

export { content, graph };
export const SITE_URL = 'https://raphaffou.github.io';

export const person = content.person;
export const papers: Paper[] = content.papers;
export const featuredProjects: Project[] = content.projects.filter((p) => p.featured && !p.aiAssisted);
export const archiveProjects: Project[] = content.projects.filter((p) => !p.featured && !p.aiAssisted);
export const aiProjects: Project[] = content.projects.filter((p) => p.aiAssisted);
export const notes: Note[] = content.notes;

export const projectBySlug = (slug: string | null | undefined) => featuredProjects.find((p) => p.slug === slug);
export const noteBySlug = (slug: string | null | undefined) => notes.find((n) => n.slug === slug);

/** Co-authors, without the site owner. */
export const coAuthors = (p: Paper) => p.authors.filter((a) => a !== person.name);

/** Everything that mentions a topic, for the list view of the Graph page. */
export function worksByTopic() {
  return content.topics
    .map((topic) => ({
      topic,
      works: [
        ...papers.filter((p) => p.topics.some((t) => t.id === topic.id)).map((p) => ({ name: p.title, kind: 'Paper', link: '/research', external: false })),
        ...content.projects
          .filter((p) => !p.aiAssisted && p.topics.some((t) => t.id === topic.id))
          .map((p) => ({
            name: p.name,
            kind: p.featured ? 'Project' : p.aiAssisted ? 'AI-assisted' : 'Archive',
            link: p.featured ? `/projects/${p.slug}` : (p.repo ?? ''),
            external: !p.featured,
          })),
        ...notes.filter((n) => n.topics.some((t) => t.id === topic.id)).map((n) => ({ name: n.headline, kind: 'Note', link: `/notes/${n.slug}`, external: false })),
      ],
    }))
    .filter((g) => g.works.length);
}
