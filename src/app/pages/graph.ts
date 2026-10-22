import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { graph, worksByTopic } from '../content/content';
import { T } from '../shared/t';

@Component({
  selector: 'app-graph',
  imports: [RouterLink, T],
  templateUrl: './graph.html',
})
export class GraphPage {
  protected readonly g = graph;
  protected readonly groups = worksByTopic();
  /** Internal links are split into path and #fragment for routerLink. */
  protected readonly nodes = graph.nodes.map((n) => {
    const [path, fragment] = n.href.split('#');
    const kind = { person: 'me', topic: 'topic', paper: 'paper', project: 'project', note: 'note' }[n.kind];
    return { ...n, path, fragment, aria: n.kind === 'topic' ? `Topic: ${n.label}` : `${n.label} (${kind})` };
  });
}
