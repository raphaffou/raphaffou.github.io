import { Component, inject } from '@angular/core';
import { person } from '../content/content';
import { T } from './t';
import { Toast } from './toast';

@Component({
  selector: 'app-contacts',
  imports: [T],
  template: `
    <div class="contacts" role="group" aria-label="Contact">
      <button class="btn fx" type="button" (click)="copy()"><span [t]="'Copy email'"></span></button>
      <a class="btn fx" [href]="person.github"><span [t]="'GitHub'"></span></a>
      <a class="btn fx" [href]="person.linkedin"><span [t]="'LinkedIn'"></span></a>
      <a class="btn fx" [href]="person.cv"><span [t]="'CV (PDF)'"></span></a>
    </div>
  `,
})
export class Contacts {
  protected readonly person = person;
  private readonly toast = inject(Toast);

  async copy() {
    try {
      await navigator.clipboard.writeText(person.email);
      this.toast.show(`Email copied: ${person.email}`);
    } catch {
      this.toast.show(`My email: ${person.email}`);
    }
  }
}
