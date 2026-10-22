import { DOCUMENT, Component, DestroyRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { person } from './content/content';
import { T } from './shared/t';
import { Toast } from './shared/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, T],
  templateUrl: './app.html',
})
export class App {
  protected readonly person = person;
  protected readonly toast = inject(Toast);
  protected readonly year = new Date().getFullYear();
  protected readonly nav = [
    { num: 'i', label: 'Research', path: '/research' },
    { num: 'ii', label: 'Projects', path: '/projects' },
    { num: 'iii', label: 'Notes', path: '/notes' },
    { num: 'iv', label: 'About', path: '/about' },
    { num: 'v', label: 'Graph', path: '/graph' },
  ];
  /** Current path, without query or fragment. */
  protected readonly path = signal('/');

  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);

  constructor() {
    const browser = isPlatformBrowser(inject(PLATFORM_ID));
    let first = true;
    const sub = this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      const url = (e as NavigationEnd).urlAfterRedirects;
      this.path.set(url.split(/[?#]/)[0] || '/');
      // After a client-side navigation, move focus to the new page's heading (or to
      // the #fragment target) so screen-reader and keyboard users start from there.
      if (browser && !first) {
        const fragment = url.includes('#') ? decodeURIComponent(url.slice(url.indexOf('#') + 1)) : null;
        setTimeout(() => {
          const target = fragment
            ? this.doc.getElementById(fragment)
            : (this.doc.querySelector<HTMLElement>('#main h1') ?? this.doc.getElementById('main'));
          if (!target) return;
          if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: !fragment });
        });
      }
      first = false;
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  /** 'page' on the exact page, 'true' inside its section (e.g. a case study under Projects). */
  protected current(path: string): 'page' | 'true' | null {
    const here = this.path();
    return here === path ? 'page' : here.startsWith(path + '/') ? 'true' : null;
  }

  protected skip(event: Event) {
    event.preventDefault();
    const main = this.doc.getElementById('main');
    main?.focus();
    main?.scrollIntoView();
  }
}
