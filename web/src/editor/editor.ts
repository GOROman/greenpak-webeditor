// Hand-rolled SVG node-graph editor with grid snapping, auto-layout,
// auto-connect and live logic preview.
import { Edge, Graph, GraphNode, NODE_DEFS, NodeType, Port, newId } from '../model';
import { Simulator, Tri } from './sim';

const triClass = (v: Tri) => (v === null ? 'z' : v ? 'hi' : 'lo');

// All node dimensions are multiples of GRID so block corners land exactly on
// grid intersections when snapped.
export const GRID = 20;
const NODE_W = GRID * 5;
const ROW_H = GRID;
const HEAD_H = GRID;

const snap = (v: number) => Math.max(0, Math.round(v / GRID) * GRID);

export class Editor {
  graph: Graph = { nodes: [], edges: [] };
  private svg: SVGSVGElement;
  private edgeLayer: SVGGElement;
  private nodeLayer: SVGGElement;
  private tempWire: SVGPathElement | null = null;
  private wireFrom: Port | null = null;
  private sim = new Simulator();
  selected: string | null = null; // node id or edge id
  onChange: (() => void) | null = null;
  onSelect: ((node: GraphNode | null) => void) | null = null;
  /** fired when a gpio_in / virt_in toggle is flipped in the preview */
  onToggle: ((node: GraphNode) => void) | null = null;

  constructor(container: HTMLElement) {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.classList.add('editor-svg');
    this.edgeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.nodeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svg.append(this.edgeLayer, this.nodeLayer);
    container.appendChild(this.svg);

    this.svg.addEventListener('pointerdown', (e) => {
      if (e.target === this.svg) this.select(null);
    });
    this.svg.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.svg.addEventListener('pointerup', () => this.cancelWire());
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        this.deleteSelected();
        e.preventDefault();
      }
    });
  }

  setGraph(g: Graph) {
    this.graph = g;
    this.sim.reset();
    this.select(null);
    this.simulate();
    this.render();
  }

  addNode(type: NodeType, x = 60, y = 60): GraphNode {
    const node: GraphNode = { id: newId(type), type, x: snap(x), y: snap(y), props: {} };
    if (type.startsWith('lut')) node.props.truth = 0;
    const spot = this.findFreeSpot(node);
    node.x = spot.x;
    node.y = spot.y;
    this.graph.nodes.push(node);
    this.render();
    this.changed();
    return node;
  }

  /** first non-overlapping grid spot; GPIO inputs stack in the left column,
   *  outputs in the right column, everything else fills row-major */
  private findFreeSpot(node: GraphNode): { x: number; y: number } {
    const w = NODE_W + GRID; // one-cell margin between blocks
    const h = this.nodeHeight(node) + GRID;
    const rect = this.svg.getBoundingClientRect();
    const maxX = Math.max(snap(rect.width - NODE_W - GRID * 2), GRID * 8);
    const overlaps = (x: number, y: number) =>
      this.graph.nodes.some(
        (n) =>
          x < n.x + NODE_W + GRID &&
          x + w > n.x &&
          y < n.y + this.nodeHeight(n) + GRID &&
          y + h > n.y,
      );
    const columns =
      node.type === 'gpio_in' || node.type === 'virt_in' || node.type === 'osc'
        ? [GRID * 2]
        : node.type === 'gpio_out'
          ? [maxX]
          : null;
    for (let y = GRID * 2; y < GRID * 200; y += GRID * 2) {
      for (const x of columns ?? rangeX(GRID * 8, maxX - GRID * 4)) {
        if (!overlaps(x, y)) return { x, y };
      }
    }
    return { x: snap(node.x), y: snap(node.y) };

    function rangeX(from: number, to: number): number[] {
      const xs: number[] = [];
      for (let x = from; x <= Math.max(from, to); x += GRID * 2) xs.push(x);
      return xs;
    }
  }

  deleteSelected() {
    const id = this.selected;
    if (!id) return;
    this.graph.edges = this.graph.edges.filter(
      (e) => e.id !== id && e.from.node !== id && e.to.node !== id,
    );
    this.graph.nodes = this.graph.nodes.filter((n) => n.id !== id);
    this.select(null, false);
    this.changed();
    this.render();
  }

  /** layered left-to-right layout by longest path from the sources */
  autoLayout() {
    const depth = new Map<string, number>();
    const inEdges = (id: string) => this.graph.edges.filter((e) => e.to.node === id);
    const calc = (id: string, seen: Set<string>): number => {
      if (depth.has(id)) return depth.get(id)!;
      if (seen.has(id)) return 0; // cycle (e.g. feedback) — cut here
      seen.add(id);
      const ins = inEdges(id);
      const d = ins.length ? Math.max(...ins.map((e) => calc(e.from.node, seen))) + 1 : 0;
      depth.set(id, d);
      return d;
    };
    for (const n of this.graph.nodes) calc(n.id, new Set());
    // GPIO inputs pin to the leftmost column, outputs to the rightmost
    for (const n of this.graph.nodes) {
      if (n.type === 'gpio_in') depth.set(n.id, 0);
      else if ((depth.get(n.id) ?? 0) === 0) depth.set(n.id, 1);
    }
    const maxInner = Math.max(
      1,
      ...this.graph.nodes.filter((n) => n.type !== 'gpio_out').map((n) => depth.get(n.id) ?? 0),
    );
    const layers = new Map<number, GraphNode[]>();
    for (const n of this.graph.nodes) {
      const d = n.type === 'gpio_out' ? maxInner + 1 : depth.get(n.id) ?? 0;
      if (!layers.has(d)) layers.set(d, []);
      layers.get(d)!.push(n);
    }
    for (const [d, nodes] of layers) {
      nodes.sort((a, b) => a.y - b.y);
      let y = GRID * 2;
      for (const n of nodes) {
        n.x = snap(GRID * 2 + d * 200);
        n.y = snap(y);
        y += this.nodeHeight(n) + GRID;
      }
    }
    this.changed();
    this.render();
  }

  /** wire every unconnected input to the nearest output on its left */
  autoConnect() {
    interface Out { port: Port; pos: { x: number; y: number } }
    const outs: Out[] = [];
    for (const n of this.graph.nodes) {
      for (const p of NODE_DEFS[n.type].outputs) {
        const port = { node: n.id, port: p };
        outs.push({ port, pos: this.portPos(port) });
      }
    }
    let added = 0;
    for (const n of this.graph.nodes) {
      for (const pname of NODE_DEFS[n.type].inputs) {
        if (this.graph.edges.some((e) => e.to.node === n.id && e.to.port === pname)) continue;
        const to = { node: n.id, port: pname };
        const pos = this.portPos(to);
        const candidates = outs.filter((o) => o.port.node !== n.id);
        const leftOnly = candidates.filter((o) => o.pos.x <= pos.x);
        const pool = leftOnly.length ? leftOnly : candidates;
        if (!pool.length) continue;
        pool.sort(
          (a, b) =>
            Math.hypot(a.pos.x - pos.x, a.pos.y - pos.y) -
            Math.hypot(b.pos.x - pos.x, b.pos.y - pos.y),
        );
        this.graph.edges.push({ id: newId('e'), from: pool[0].port, to });
        added++;
      }
    }
    if (added) {
      this.changed();
      this.simulate();
      this.render();
    }
    return added;
  }

  private select(id: string | null, rerender = true) {
    this.selected = id;
    const node = this.graph.nodes.find((n) => n.id === id) ?? null;
    this.onSelect?.(node);
    // A full render tears down the element holding pointer capture, so the
    // pointerdown path only retints CSS classes instead.
    if (rerender) this.render();
    else {
      this.svg.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected'));
    }
  }

  private changed() {
    this.onChange?.();
  }

  refresh() {
    this.simulate();
    this.render();
  }

  simulate() {
    this.sim.step(this.graph);
  }

  // --- geometry ---------------------------------------------------------
  private nodeHeight(n: GraphNode): number {
    const d = NODE_DEFS[n.type];
    return HEAD_H + Math.max(d.inputs.length, d.outputs.length, 1) * ROW_H;
  }

  private portPos(p: Port): { x: number; y: number } {
    const n = this.graph.nodes.find((nn) => nn.id === p.node)!;
    const d = NODE_DEFS[n.type];
    const inIdx = d.inputs.indexOf(p.port);
    if (inIdx >= 0) return { x: n.x, y: n.y + HEAD_H + inIdx * ROW_H + ROW_H / 2 };
    const outIdx = d.outputs.indexOf(p.port);
    return { x: n.x + NODE_W, y: n.y + HEAD_H + outIdx * ROW_H + ROW_H / 2 };
  }

  private svgPoint(e: PointerEvent): { x: number; y: number } {
    const r = this.svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // --- wiring -----------------------------------------------------------
  private startWire(from: Port, e: PointerEvent) {
    this.wireFrom = from;
    this.tempWire = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.tempWire.classList.add('wire', 'wire-temp');
    this.edgeLayer.appendChild(this.tempWire);
    this.updateTempWire(this.svgPoint(e));
    e.stopPropagation();
  }

  private updateTempWire(to: { x: number; y: number }) {
    if (!this.tempWire || !this.wireFrom) return;
    const a = this.portPos(this.wireFrom);
    this.tempWire.setAttribute('d', wirePath(a, to));
  }

  private finishWire(to: Port) {
    if (!this.wireFrom) return;
    // one driver per input: replace existing edge into this input
    this.graph.edges = this.graph.edges.filter(
      (e) => !(e.to.node === to.node && e.to.port === to.port),
    );
    this.graph.edges.push({ id: newId('e'), from: this.wireFrom, to });
    this.cancelWire();
    this.changed();
    this.simulate();
    this.render();
  }

  private cancelWire() {
    this.tempWire?.remove();
    this.tempWire = null;
    this.wireFrom = null;
  }

  private onPointerMove(e: PointerEvent) {
    if (this.tempWire) this.updateTempWire(this.svgPoint(e));
  }

  // --- rendering --------------------------------------------------------
  private render() {
    this.nodeLayer.innerHTML = '';
    this.renderEdgesOnly();
    for (const node of this.graph.nodes) this.renderNode(node);
  }

  private renderEdgesOnly() {
    this.edgeLayer.innerHTML = '';
    for (const edge of this.graph.edges) this.renderEdge(edge);
    if (this.tempWire) this.edgeLayer.appendChild(this.tempWire);
  }

  private renderEdge(edge: Edge) {
    const v = this.sim.values.get(edge.from.node) ?? null;
    const hi = v === true;
    const d = wirePath(this.portPos(edge.from), this.portPos(edge.to));
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('wire', triClass(v));
    if (edge.id === this.selected) path.classList.add('selected');
    path.setAttribute('d', d);
    path.addEventListener('pointerdown', (e) => {
      this.select(edge.id, false);
      path.classList.add('selected');
      e.stopPropagation();
    });
    this.edgeLayer.appendChild(path);
    if (hi) {
      // glowing dots flowing from source to destination
      const flow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      flow.classList.add('wire-flow');
      flow.setAttribute('d', d);
      this.edgeLayer.appendChild(flow);
    }
  }

  private renderNode(node: GraphNode) {
    const d = NODE_DEFS[node.type];
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node', `node-${node.type}`);
    g.setAttribute('transform', `translate(${node.x},${node.y})`);
    const h = this.nodeHeight(node);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('node-body');
    if (node.id === this.selected) rect.classList.add('selected');
    rect.setAttribute('width', String(NODE_W));
    rect.setAttribute('height', String(h));
    rect.setAttribute('rx', '2');
    g.appendChild(rect);

    const head = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    head.classList.add('node-head');
    head.setAttribute(
      'd',
      `M 0 ${HEAD_H} L 0 2 Q 0 0 2 0 L ${NODE_W - 2} 0 Q ${NODE_W} 0 ${NODE_W} 2 L ${NODE_W} ${HEAD_H} Z`,
    );
    g.appendChild(head);

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.classList.add('node-title');
    title.setAttribute('x', '6');
    title.setAttribute('y', '14');
    const label = this.nodeLabel(node);
    title.textContent = label;
    // squeeze long labels so they never overflow the block
    const maxW = NODE_W - (node.type === 'gpio_out' || node.type === 'dff' ? 24 : 12);
    if (label.length * 7 > maxW) {
      title.setAttribute('textLength', String(maxW));
      title.setAttribute('lengthAdjust', 'spacingAndGlyphs');
    }
    g.appendChild(title);

    // live value badge in the header corner of gpio_out / dff / osc
    if (node.type === 'gpio_out' || node.type === 'dff' || node.type === 'osc') {
      const v = this.sim.values.get(node.id) ?? null;
      const badge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      badge.classList.add('value-badge', 'corner', triClass(v));
      badge.setAttribute('x', String(NODE_W - 6));
      badge.setAttribute('y', '14');
      badge.textContent = v === null ? 'Z' : v ? '1' : '0';
      g.appendChild(badge);
    }

    // toggle switch on gpio_in / I2C virtual input
    if (node.type === 'gpio_in' || node.type === 'virt_in') {
      const v = !!node.props.value;
      const sw = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      sw.classList.add('toggle', v ? 'hi' : 'lo');
      const track = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      track.setAttribute('x', String(NODE_W / 2 - 16));
      track.setAttribute('y', String(HEAD_H + 4));
      track.setAttribute('width', '32');
      track.setAttribute('height', '14');
      track.setAttribute('rx', '7');
      track.classList.add('toggle-track');
      const knob = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      knob.setAttribute('cx', String(NODE_W / 2 + (v ? 9 : -9)));
      knob.setAttribute('cy', String(HEAD_H + 11));
      knob.setAttribute('r', '5');
      knob.classList.add('toggle-knob');
      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.classList.add('value-badge', v ? 'hi' : 'lo');
      lbl.setAttribute('x', String(NODE_W / 2 + (v ? -12 : 12)));
      lbl.setAttribute('y', String(HEAD_H + 15));
      lbl.textContent = v ? '1' : '0';
      sw.append(track, knob, lbl);
      sw.addEventListener('pointerdown', (e) => {
        node.props.value = v ? 0 : 1;
        this.onToggle?.(node);
        this.simulate();
        this.render();
        e.stopPropagation();
      });
      g.appendChild(sw);
    }

    // drag node / select
    let drag: { dx: number; dy: number; moved: boolean } | null = null;
    const beginDrag = (e: PointerEvent) => {
      this.select(node.id, false);
      rect.classList.add('selected');
      const p = this.svgPoint(e);
      drag = { dx: p.x - node.x, dy: p.y - node.y, moved: false };
      rect.setPointerCapture(e.pointerId);
      e.stopPropagation();
    };
    const moveDrag = (e: PointerEvent) => {
      if (!drag) return;
      const p = this.svgPoint(e);
      const nx = snap(p.x - drag.dx);
      const ny = snap(p.y - drag.dy);
      if (nx !== node.x || ny !== node.y) {
        node.x = nx;
        node.y = ny;
        drag.moved = true;
        g.setAttribute('transform', `translate(${node.x},${node.y})`);
        this.renderEdgesOnly();
      }
    };
    const endDrag = () => {
      if (drag?.moved) this.changed();
      if (drag) {
        drag = null;
        this.render();
      }
    };
    for (const el of [rect, head, title] as SVGElement[]) {
      el.addEventListener('pointerdown', beginDrag as EventListener);
      el.addEventListener('pointermove', moveDrag as EventListener);
      el.addEventListener('pointerup', endDrag);
    }

    d.inputs.forEach((port, i) => {
      const drv = this.graph.edges.find((e) => e.to.node === node.id && e.to.port === port);
      const v: Tri = drv ? this.sim.values.get(drv.from.node) ?? null : null;
      g.appendChild(this.renderPort(node, port, 0, HEAD_H + i * ROW_H + ROW_H / 2, true, v));
    });
    d.outputs.forEach((port, i) => {
      const v: Tri = this.sim.values.get(node.id) ?? null;
      g.appendChild(this.renderPort(node, port, NODE_W, HEAD_H + i * ROW_H + ROW_H / 2, false, v));
    });
    this.nodeLayer.appendChild(g);
  }

  private nodeLabel(node: GraphNode): string {
    if (node.label) return node.label;
    const d = NODE_DEFS[node.type];
    if (node.type === 'gpio_in' || node.type === 'gpio_out') {
      return node.props.pin != null ? `${d.title} P${node.props.pin}` : `${d.title} (pin?)`;
    }
    if (node.type === 'virt_in') return `I2C VIN${node.props.virtIndex ?? '?'}`;
    if (node.type === 'osc') {
      const f = { osc0_2k: '2.0kHz', osc1_2m: '2.0MHz', osc2_25m: '25MHz' } as const;
      return `OSC ${f[node.props.osc ?? 'osc0_2k']}`;
    }
    if (node.type.startsWith('lut')) {
      return `${d.title} ${(node.props.truth ?? 0).toString(16).toUpperCase()}h`;
    }
    return d.title;
  }

  private renderPort(
    node: GraphNode,
    port: string,
    x: number,
    y: number,
    isInput: boolean,
    v: Tri = null,
  ) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.classList.add('port', triClass(v));
    c.setAttribute('cx', String(x));
    c.setAttribute('cy', String(y));
    c.setAttribute('r', '5');
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.classList.add('port-label');
    label.setAttribute('x', String(isInput ? x + 9 : x - 9));
    label.setAttribute('y', String(y + 3.5));
    label.setAttribute('text-anchor', isInput ? 'start' : 'end');
    label.textContent = port;
    g.append(c, label);

    const p: Port = { node: node.id, port };
    if (isInput) {
      c.addEventListener('pointerup', () => {
        if (this.wireFrom) this.finishWire(p);
      });
    } else {
      c.addEventListener('pointerdown', (e) => this.startWire(p, e));
    }
    return g;
  }
}

function wirePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dx = Math.max(30, Math.abs(b.x - a.x) / 2);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}
