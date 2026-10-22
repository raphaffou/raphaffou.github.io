import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { T } from '../shared/t';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, T],
  template: `
    <h1>Page not found</h1>
    <p class="lead">There is nothing at this address, or not anymore.</p>
    <p><a class="fx inline" routerLink="/"><span [t]="'Back to the home page'"></span></a></p>
  `,
})
export class NotFound {}
