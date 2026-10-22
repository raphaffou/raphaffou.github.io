import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { archiveProjects, featuredProjects } from '../content/content';
import { T } from '../shared/t';

@Component({
  selector: 'app-projects',
  imports: [RouterLink, T],
  templateUrl: './projects.html',
})
export class Projects {
  protected readonly featured = featuredProjects;
  protected readonly archive = archiveProjects;
}
