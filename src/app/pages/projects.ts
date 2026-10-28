import { Component } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { aiProjects, archiveProjects, featuredProjects } from '../content/content';
import { T } from '../shared/t';

@Component({
  selector: 'app-projects',
  imports: [NgTemplateOutlet, RouterLink, T],
  templateUrl: './projects.html',
})
export class Projects {
  protected readonly featured = featuredProjects;
  protected readonly archive = archiveProjects;
  protected readonly ai = aiProjects;
}
