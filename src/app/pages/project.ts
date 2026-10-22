import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { featuredProjects, projectBySlug } from '../content/content';
import { T } from '../shared/t';

@Component({
  selector: 'app-project',
  imports: [RouterLink, T],
  templateUrl: './project.html',
})
export class ProjectPage {
  /** Bound from the :slug route parameter. */
  readonly slug = input.required<string>();
  protected readonly project = computed(() => projectBySlug(this.slug())!);
  protected readonly next = computed(() => {
    const i = featuredProjects.findIndex((p) => p.slug === this.slug());
    return featuredProjects[(i + 1) % featuredProjects.length];
  });
}
