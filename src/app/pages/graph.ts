import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { dataGraph, ontologyGraph } from '../content/content';
import type { RdfEdge, RdfGraph, RdfNode } from '../content/content.model';
import { T } from '../shared/t';

type View = 'ontology' | 'data';
const GRAPHS: Record<View, RdfGraph> = { ontology: ontologyGraph, data: dataGraph };
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

interface Link {
  /** true: from the node to `node`; false: from `node` to it. */
  out: boolean;
  label: string;
  node: RdfNode;
}

/** The links of every node of a graph, outgoing first. */
function linksOf(g: RdfGraph) {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const links = new Map<string, Link[]>(g.nodes.map((n) => [n.id, []]));
  for (const e of g.edges) {
    links.get(e.source)!.push({ out: true, label: e.label, node: byId.get(e.target)! });
    links.get(e.target)!.push({ out: false, label: e.label, node: byId.get(e.source)! });
  }
  for (const l of links.values())
    l.sort((a, b) => Number(b.out) - Number(a.out) || a.label.localeCompare(b.label) || a.node.label.localeCompare(b.node.label));
  return links;
}
const LINKS: Record<View, Map<string, Link[]>> = { ontology: linksOf(ontologyGraph), data: linksOf(dataGraph) };

/** "about: LLMs, NLP", one line per property, for the lists below the graph. */
function summarise(links: Link[]) {
  const lines = new Map<string, string[]>();
  for (const l of links) {
    const key = l.out ? `${l.label} →` : `← ${l.label}`;
    lines.set(key, [...(lines.get(key) ?? []), l.node.label]);
  }
  return [...lines].map(([property, nodes]) => ({ property, nodes: nodes.join(', ') }));
}

/** Entries of the data grouped by their class, for the list below the graph. */
function groupByClass(g: RdfGraph) {
  const groups = new Map<string, RdfNode[]>();
  for (const n of [...g.nodes].sort((a, b) => a.label.localeCompare(b.label))) {
    const c = n.classes[0] ?? 'Other';
    groups.set(c, [...(groups.get(c) ?? []), n]);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, nodes]) => ({ name, nodes: nodes.map((n) => ({ ...n, lines: summarise(LINKS.data.get(n.id)!) })) }));
}

@Component({
  selector: 'app-graph',
  imports: [RouterLink, T],
  templateUrl: './graph.html',
})
export class GraphPage {
  protected readonly view = signal<View>('ontology');
  protected readonly g = computed(() => GRAPHS[this.view()]);
  protected readonly classes = [...ontologyGraph.nodes]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((n) => ({
      ...n,
      properties: n.props.map((p) => `${p.name} (${p.value})`).join(', '),
      lines: summarise(LINKS.ontology.get(n.id)!),
    }));
  protected readonly entries = groupByClass(dataGraph);

  protected readonly selected = signal<string | null>(null);
  private readonly hovered = signal<string | null>(null);
  private readonly focused = signal<string | null>(null);
  /** The node whose links stand out: under the pointer, else with keyboard focus, else selected. */
  protected readonly focus = computed(() => this.hovered() ?? this.focused() ?? this.selected());
  /** The focused node and its neighbours; everything else is dimmed. */
  private readonly near = computed(() => {
    const f = this.focus();
    return f ? new Set([f, ...LINKS[this.view()].get(f)!.map((l) => l.node.id)]) : null;
  });
  protected readonly current = computed(() => this.g().nodes.find((n) => n.id === this.selected()) ?? null);
  protected readonly links = computed(() => (this.current() ? LINKS[this.view()].get(this.current()!.id)! : []));
  /** A topic opened from another page (/graph#topic-llms) gives the figure its id, so the page scrolls to it. */
  protected readonly anchor = computed(() => {
    const c = this.current();
    return this.view() === 'data' && c?.kind === 'topic' ? 'topic-' + c.id : 'graph';
  });

  // Zoom and pan, in the units of the SVG viewBox.
  private readonly k = signal(1);
  private readonly tx = signal(0);
  private readonly ty = signal(0);
  protected readonly transform = computed(() => `translate(${this.tx()} ${this.ty()}) scale(${this.k()})`);
  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');
  private readonly title = viewChild<ElementRef<HTMLElement>>('title');
  private drag: { id: number; x: number; y: number; tx: number; ty: number; moved: boolean } | null = null;

  constructor() {
    const route = inject(ActivatedRoute);
    const destroyRef = inject(DestroyRef);
    // After the first render, so the browser starts from the same page as the prerendered HTML.
    afterNextRender(() => {
      this.fit();
      route.fragment.pipe(takeUntilDestroyed(destroyRef)).subscribe((f) => {
        const id = f?.startsWith('topic-') ? f.slice('topic-'.length) : null;
        if (id && dataGraph.nodes.some((n) => n.id === id && n.kind === 'topic')) {
          this.show('data');
          this.selected.set(id);
        }
      });
    });
  }

  protected show(view: View) {
    if (view === this.view()) return;
    this.view.set(view);
    this.selected.set(null);
    this.hovered.set(null);
    this.focused.set(null);
    this.fit();
  }

  protected toggle(id: string) {
    this.selected.update((s) => (s === id ? null : id));
  }

  /** From the panel: select a neighbour, and keep keyboard focus in the panel. */
  protected go(id: string) {
    this.selected.set(id);
    setTimeout(() => this.title()?.nativeElement.focus({ preventScroll: true }));
  }

  protected hover(id: string | null) {
    this.hovered.set(id);
  }
  /** Only keyboard focus highlights: a click already selects. */
  protected focusNode(event: FocusEvent, id: string | null) {
    this.focused.set(id && (event.target as Element).matches(':focus-visible') ? id : null);
  }

  protected dim(id: string) {
    const near = this.near();
    return !!near && !near.has(id);
  }
  protected lit(e: RdfEdge) {
    const f = this.focus();
    return !!f && (e.source === f || e.target === f);
  }
  /** Edge labels: always on the ontology, only around the focused entry on the data. */
  protected labelled(e: RdfEdge) {
    return this.lit(e) || (this.view() === 'ontology' && !this.focus());
  }

  protected aria(n: RdfNode) {
    return this.view() === 'ontology' ? `Class ${n.label}` : `${n.label} (${n.classes.join(', ')})`;
  }

  /** Zooms by a factor around a point of the viewBox, the centre by default. */
  protected zoom(factor: number, px = this.g().width / 2, py = this.g().height / 2) {
    const k = this.k();
    const k2 = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k * factor));
    this.tx.update((tx) => px - ((px - tx) * k2) / k);
    this.ty.update((ty) => py - ((py - ty) * k2) / k);
    this.k.set(k2);
  }

  /** Whole graph in view; on a narrow screen, zoomed in enough to read the labels. */
  protected fit() {
    const width = this.svg()?.nativeElement.getBoundingClientRect().width;
    const { width: w, height: h } = this.g();
    const k = width && width / w < 0.75 ? Math.min(MAX_ZOOM, (0.75 * w) / width) : 1;
    this.k.set(k);
    this.tx.set((w / 2) * (1 - k));
    this.ty.set(k === 1 ? 0 : (h / 2) * (1 - k));
  }

  /** Screen pixels to viewBox units. */
  private scale() {
    const rect = this.svg()!.nativeElement.getBoundingClientRect();
    return { rect, s: this.g().width / rect.width };
  }

  protected wheel(event: WheelEvent) {
    // A plain wheel scrolls the page; Ctrl/⌘ + wheel (and a trackpad pinch) zooms.
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const { rect, s } = this.scale();
    this.zoom(Math.exp(-event.deltaY * 0.002), (event.clientX - rect.left) * s, (event.clientY - rect.top) * s);
  }

  protected down(event: PointerEvent) {
    if (event.button !== 0 || (event.target as Element).closest('.rg-node')) return;
    this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, tx: this.tx(), ty: this.ty(), moved: false };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  }

  protected move(event: PointerEvent) {
    const d = this.drag;
    if (!d || d.id !== event.pointerId) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    const { s } = this.scale();
    this.tx.set(d.tx + dx * s);
    this.ty.set(d.ty + dy * s);
  }

  protected up(event: PointerEvent) {
    const d = this.drag;
    if (!d || d.id !== event.pointerId) return;
    this.drag = null;
    if (!d.moved && event.type === 'pointerup') this.selected.set(null); // a click on the background
  }
}

// The previous Graph page (topics as hubs) used, with `graph` and `worksByTopic` from
// ../content/content (see buildTopicGraph in scripts/build-content.mjs, and the template
// commented at the end of graph.html):
//
//   protected readonly g = graph;
//   protected readonly groups = worksByTopic();
//   /** Internal links are split into path and #fragment for routerLink. */
//   protected readonly nodes = graph.nodes.map((n) => {
//     const [path, fragment] = n.href.split('#');
//     const kind = { person: 'me', topic: 'topic', paper: 'paper', project: 'project', note: 'note' }[n.kind];
//     return { ...n, path, fragment, aria: n.kind === 'topic' ? `Topic: ${n.label}` : `${n.label} (${kind})` };
//   });
