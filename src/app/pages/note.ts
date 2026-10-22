import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { noteBySlug } from '../content/content';
import { T } from '../shared/t';

@Component({
  selector: 'app-note',
  imports: [RouterLink, T],
  templateUrl: './note.html',
})
export class NotePage {
  /** Bound from the :slug route parameter. */
  readonly slug = input.required<string>();
  protected readonly note = computed(() => noteBySlug(this.slug())!);
  // The HTML is produced at build time from your own Turtle file, so it is trusted
  // (this keeps the data-text attribute the link hover needs).
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly body = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.note().html));
}
