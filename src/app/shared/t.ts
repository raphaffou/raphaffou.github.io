import { Component, input } from '@angular/core';

/**
 * The text of a link or button that gets the negative-rainbow hover (see styles.css, section 3).
 * Usage: <a class="fx" href="…"><span [t]="'Projects'"></span></a>
 */
@Component({
  selector: 'span[t]',
  template: '{{ t() }}',
  host: { class: 't' },
})
export class T {
  readonly t = input.required<string>();
}
