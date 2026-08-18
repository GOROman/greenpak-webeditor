// Interactive tri-state logic simulation of the editor graph.
// H = true, L = false, Hi-Z / unknown = null. Unconnected inputs are Z and
// Z propagates through logic unless the truth table proves it irrelevant.
// gpio_in values come from node.props.value (toggled in the UI); DFF state is
// kept here between calls so clock edges register.
import { Graph } from '../model';

export type Tri = boolean | null;

export class Simulator {
  private dffState = new Map<string, Tri>();
  private lastClk = new Map<string, boolean>();
  /** value of each node's output after the last step() */
  values = new Map<string, Tri>();

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

    const inVal = (nodeId: string, port: string): Tri => {
      const d = driver.get(`${nodeId}:${port}`);
      return d ? (this.values.get(d.node) ?? null) : null;
    };

    // 3-valued LUT: enumerate the Z inputs; if every combination agrees the
    // output is defined, otherwise it is Z.
    const lutOut = (truth: number, ins: Tri[]): Tri => {
      const zIdx = ins.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
      let out: Tri | undefined;
      for (let m = 0; m < 1 << zIdx.length; m++) {
        let idx = 0;
        ins.forEach((v, i) => {
          const bit = v === null ? (m >> zIdx.indexOf(i)) & 1 : v ? 1 : 0;
          if (bit) idx |= 1 << i;
        });
        const o = ((truth >> idx) & 1) === 1;
        if (out === undefined) out = o;
        else if (out !== o) return null;
      }
      return out ?? null;
    };

    // A few settle+clock rounds so ripple structures (FF chains) propagate.
    for (let round = 0; round < 8; round++) {
      // combinational fixpoint with DFF outputs held
      for (let pass = 0; pass < 32; pass++) {
        let changed = false;
        for (const node of graph.nodes) {
          let v: Tri;
          switch (node.type) {
            case 'vdd': v = true; break;
            case 'gnd': v = false; break;
            case 'gpio_in':
            case 'virt_in':
            case 'osc':
              v = !!node.props.value;
              break;
            case 'gpio_out': v = inVal(node.id, 'in0'); break;
            case 'dff': {
              const q = this.dffState.get(node.id) ?? false;
              v = q === null ? null : node.props.invertQ ? !q : q;
              break;
            }
            default: { // lut2/3/4
              const n = Number(node.type[3]);
              const ins: Tri[] = [];
              for (let i = 0; i < n; i++) ins.push(inVal(node.id, `in${i}`));
              v = lutOut(node.props.truth ?? 0, ins);
            }
          }
          if (this.values.get(node.id) !== v) {
            this.values.set(node.id, v);
            changed = true;
          }
        }
        if (!changed) break;
      }
      // clock DFFs (chip-accurate: rst port is active-low nRST, unconnected/Z = inactive)
      let stateChanged = false;
      for (const node of graph.nodes) {
        if (node.type !== 'dff') continue;
        const clk = inVal(node.id, 'clk');
        const nRst = inVal(node.id, 'rst');
        let q: Tri = this.dffState.get(node.id) ?? false;
        if (nRst === false) {
          q = false;
        } else if (clk !== null) {
          // first evaluation just records the clock level — no spurious edge
          const prev = this.lastClk.has(node.id) ? this.lastClk.get(node.id)! : clk;
          if (clk && !prev) q = inVal(node.id, 'd');
          this.lastClk.set(node.id, clk);
        }
        if (q !== (this.dffState.get(node.id) ?? false)) {
          this.dffState.set(node.id, q);
          stateChanged = true;
        }
      }
      if (!stateChanged) break;
    }
  }
}
