// Interactive logic simulation of the editor graph.
// gpio_in values come from node.props.value (toggled in the UI); DFF state is
// kept here between calls so clock edges register.
import { Graph } from '../model';

export class Simulator {
  private dffState = new Map<string, boolean>();
  private lastClk = new Map<string, boolean>();
  /** value of each node's output after the last step() */
  values = new Map<string, boolean>();

  reset() {
    this.dffState.clear();
    this.lastClk.clear();
    this.values.clear();
  }

  /** drop state for nodes that no longer exist */
  prune(graph: Graph) {
    const ids = new Set(graph.nodes.map((n) => n.id));
    for (const k of [...this.dffState.keys()]) if (!ids.has(k)) this.dffState.delete(k);
    for (const k of [...this.lastClk.keys()]) if (!ids.has(k)) this.lastClk.delete(k);
  }

  step(graph: Graph) {
    this.prune(graph);
    const driver = new Map<string, { node: string }>();
    for (const e of graph.edges) driver.set(`${e.to.node}:${e.to.port}`, { node: e.from.node });

    const inVal = (nodeId: string, port: string, fallback: boolean): boolean => {
      const d = driver.get(`${nodeId}:${port}`);
      return d ? (this.values.get(d.node) ?? false) : fallback;
    };

    // A few settle+clock rounds so ripple structures (FF chains) propagate.
    for (let round = 0; round < 8; round++) {
      // combinational fixpoint with DFF outputs held
      for (let pass = 0; pass < 32; pass++) {
        let changed = false;
        for (const node of graph.nodes) {
          let v: boolean;
          switch (node.type) {
            case 'vdd': v = true; break;
            case 'gnd': v = false; break;
            case 'gpio_in': v = !!node.props.value; break;
            case 'gpio_out': v = inVal(node.id, 'in0', false); break;
            case 'dff': {
              const q = this.dffState.get(node.id) ?? false;
              v = node.props.invertQ ? !q : q;
              break;
            }
            default: { // lut2/3/4
              const n = Number(node.type[3]);
              let idx = 0;
              for (let i = 0; i < n; i++) if (inVal(node.id, `in${i}`, false)) idx |= 1 << i;
              v = (((node.props.truth ?? 0) >> idx) & 1) === 1;
            }
          }
          if (this.values.get(node.id) !== v) {
            this.values.set(node.id, v);
            changed = true;
          }
        }
        if (!changed) break;
      }
      // clock DFFs (chip-accurate: rst port is active-low nRST, unconnected = high)
      let stateChanged = false;
      for (const node of graph.nodes) {
        if (node.type !== 'dff') continue;
        const clk = inVal(node.id, 'clk', false);
        const nRst = inVal(node.id, 'rst', true);
        // first evaluation just records the clock level — no spurious edge
        const prev = this.lastClk.has(node.id) ? this.lastClk.get(node.id)! : clk;
        let q = this.dffState.get(node.id) ?? false;
        if (!nRst) q = false;
        else if (clk && !prev) q = inVal(node.id, 'd', false);
        this.lastClk.set(node.id, clk);
        if (q !== (this.dffState.get(node.id) ?? false)) {
          this.dffState.set(node.id, q);
          stateChanged = true;
        }
      }
      if (!stateChanged) break;
    }
  }
}
