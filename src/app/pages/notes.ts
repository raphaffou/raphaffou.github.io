import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { notes } from '../content/content';
import { T } from '../shared/t';

@Component({
  selector: 'app-notes',
  imports: [RouterLink, T],
  templateUrl: './notes.html',
})
export class Notes {
  protected readonly notes = notes;
}
