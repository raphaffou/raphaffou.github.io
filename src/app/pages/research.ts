import { Component, inject } from '@angular/core';
import { papers, person } from '../content/content';
import { T } from '../shared/t';
import { Toast } from '../shared/toast';

@Component({
  selector: 'app-research',
  imports: [T],
  templateUrl: './research.html',
})
export class Research {
  protected readonly papers = papers;
  protected readonly me = person.name;
  private readonly toast = inject(Toast);

  async copyBibtex(bibtex: string) {
    try {
      await navigator.clipboard.writeText(bibtex);
      this.toast.show('BibTeX copied');
    } catch {
      this.toast.show('Copy failed: select the BibTeX above instead');
    }
  }
}
