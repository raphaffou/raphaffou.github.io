import { CanMatchFn, ResolveFn, Routes } from '@angular/router';
import { noteBySlug, notes, person, projectBySlug } from './content/content';
import { About } from './pages/about';
import { GraphPage } from './pages/graph';
import { Home } from './pages/home';
import { NotFound } from './pages/not-found';
import { NotePage } from './pages/note';
import { Notes } from './pages/notes';
import { ProjectPage } from './pages/project';
import { Projects } from './pages/projects';
import { Research } from './pages/research';

// Unknown slugs fall through to the 404 page instead of rendering an empty case study.
const projectExists: CanMatchFn = (_route, segments) => !!projectBySlug(segments[1]?.path);
const noteExists: CanMatchFn = (_route, segments) => !!noteBySlug(segments[1]?.path);
const projectTitle: ResolveFn<string> = (route) => projectBySlug(route.paramMap.get('slug'))?.name ?? 'Project';
const projectDescription: ResolveFn<string> = (route) => projectBySlug(route.paramMap.get('slug'))?.summary ?? '';
const noteTitle: ResolveFn<string> = (route) => noteBySlug(route.paramMap.get('slug'))?.headline ?? 'Note';
const noteDescription: ResolveFn<string> = (route) => noteBySlug(route.paramMap.get('slug'))?.summary ?? '';

export const routes: Routes = [
  { path: '', component: Home, data: { description: person.description } },
  { path: 'research', component: Research, title: 'Research', data: { description: 'Research by Raphaël Thieffry: LLMs and readability assessment.' } },
  { path: 'projects', component: Projects, title: 'Projects', data: { description: 'Projects by Raphaël Thieffry: machine learning, web, compilers, algorithms and more.' } },
  {
    path: 'projects/:slug',
    component: ProjectPage,
    canMatch: [projectExists],
    title: projectTitle,
    resolve: { description: projectDescription },
  },
  { path: 'notes', component: Notes, title: 'Notes', data: { description: 'Notes by Raphaël Thieffry: home lab, experiments and things learned.' } },
  // The note route only exists once there is a note to prerender.
  ...(notes.length
    ? [{ path: 'notes/:slug', component: NotePage, canMatch: [noteExists], title: noteTitle, resolve: { description: noteDescription } }]
    : []),
  { path: 'about', component: About, title: 'About', data: { description: 'About Raphaël Thieffry: path, skills, languages and contact.' } },
  { path: 'graph', component: GraphPage, title: 'Graph', data: { description: 'Everything on this site, linked by topic.' } },
  { path: '404', component: NotFound, title: 'Page not found', data: { noindex: true } },
  { path: '**', component: NotFound, title: 'Page not found', data: { noindex: true } },
];
