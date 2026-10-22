import { RenderMode, ServerRoute } from '@angular/ssr';
import { featuredProjects, notes } from './content/content';

// Every page is prerendered to static HTML at build time (no server needed).
export const serverRoutes: ServerRoute[] = [
  {
    path: 'projects/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => featuredProjects.map((p) => ({ slug: p.slug! })),
  },
  ...(notes.length
    ? [{ path: 'notes/:slug', renderMode: RenderMode.Prerender, getPrerenderParams: async () => notes.map((n) => ({ slug: n.slug })) } as ServerRoute]
    : []),
  { path: '**', renderMode: RenderMode.Prerender },
];
