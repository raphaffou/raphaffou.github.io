import { Injectable, signal } from '@angular/core';

/** One polite live region for the whole site (see the shell template). */
@Injectable({ providedIn: 'root' })
export class Toast {
  readonly message = signal('');
  readonly visible = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  show(message: string) {
    this.message.set(message);
    this.visible.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.visible.set(false), 2600);
  }
}
