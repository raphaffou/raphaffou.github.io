import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { person, SITE_URL } from '../content/content';

/**
 * Page <title>, description, Open Graph tags and canonical URL, from each route's
 * `title` and `data.description` (or a resolved `description`).
 */
@Injectable({ providedIn: 'root' })
export class SiteTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  override updateTitle(state: RouterStateSnapshot) {
    const page = this.buildTitle(state);
    const full = page ? `${page} · ${person.name}` : `${person.name} · ${person.jobTitle}`;
    let route = state.root;
    while (route.firstChild) route = route.firstChild;
    const description: string = route.data['description'] ?? person.description;
    const path = state.url.split(/[?#]/)[0].replace(/\/$/, '');
    const url = `${SITE_URL}${path}/`;

    this.title.setTitle(full);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: full });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: url });
    if (route.data['noindex']) this.meta.updateTag({ name: 'robots', content: 'noindex' });
    else this.meta.removeTag('name="robots"');

    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', route.data['noindex'] ? `${SITE_URL}/` : url);
  }
}
