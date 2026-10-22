import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { coAuthors, featuredProjects, notes, papers, person } from '../content/content';
import { Contacts } from '../shared/contacts';
import { T } from '../shared/t';

@Component({
  selector: 'app-home',
  imports: [RouterLink, Contacts, T],
  templateUrl: './home.html',
})
export class Home {
  protected readonly person = person;
  protected readonly papers = papers;
  protected readonly projects = featuredProjects;
  protected readonly notes = notes.slice(0, 3);
  protected readonly coAuthors = coAuthors;
}
