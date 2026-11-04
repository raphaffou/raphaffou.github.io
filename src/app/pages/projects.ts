import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { Location, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { aiProjects, archivedProjects, featuredProjects, otherProjects } from '../content/content';
import type { Project } from '../content/content.model';
import { T } from '../shared/t';

const CONTEXTS = ['Work', 'Course', 'Personal'];
const ALL = [...featuredProjects, ...otherProjects, ...aiProjects, ...archivedProjects];

@Component({
  selector: 'app-projects',
  imports: [NgTemplateOutlet, RouterLink, T],
  templateUrl: './projects.html',
})
export class Projects {
  /** The filter buttons, with how many projects each one shows. */
  protected readonly filters = [
    { name: 'All', context: null, count: ALL.length },
    ...CONTEXTS.map((c) => ({ name: c, context: c, count: ALL.filter((p) => p.contexts.includes(c)).length })),
  ];
  /** null: every project. */
  protected readonly context = signal<string | null>(null);
  protected readonly featured = this.only(featuredProjects);
  protected readonly other = this.only(otherProjects);
  protected readonly ai = this.only(aiProjects);
  protected readonly archived = this.only(archivedProjects);
  protected readonly count = computed(
    () => this.featured().length + this.other().length + this.ai().length + this.archived().length,
  );

  private readonly location = inject(Location);

  constructor() {
    const route = inject(ActivatedRoute);
    // After the first render, so the browser starts from the same page as the prerendered HTML.
    afterNextRender(() => {
      const c = route.snapshot.queryParamMap.get('context');
      this.context.set(CONTEXTS.find((x) => x.toLowerCase() === c?.toLowerCase()) ?? null);
    });
  }

  /** Keeps the filter in the address (/projects?context=work) without a navigation, so focus and scroll stay put. */
  protected filter(context: string | null) {
    this.context.set(context);
    this.location.replaceState('/projects', context ? `context=${context.toLowerCase()}` : '');
  }

  private only(projects: Project[]) {
    return computed(() => {
      const c = this.context();
      return c ? projects.filter((p) => p.contexts.includes(c)) : projects;
    });
  }
}
