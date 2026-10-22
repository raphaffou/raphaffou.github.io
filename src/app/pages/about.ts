import { Component } from '@angular/core';
import { person } from '../content/content';
import { Contacts } from '../shared/contacts';
import { T } from '../shared/t';

@Component({
  selector: 'app-about',
  imports: [Contacts, T],
  templateUrl: './about.html',
})
export class About {
  protected readonly person = person;
}
