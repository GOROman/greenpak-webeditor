import { describe, expect, it } from 'vitest';
import { Simulator } from './sim';
import { PRESETS } from '../presets/presets74';

describe('Simulator', () => {
  it('74393 preset counts clock rising edges in binary', () => {
    const graph = PRESETS.find((p) => p.id === '74393')!.build();
    const clk = graph.nodes.find((n) => n.label === 'CLK')!;
    const qOuts = [0, 1, 2, 3].map(
      (i) => graph.nodes.find((n) => n.type === 'gpio_out' && n.label === `Q${i}`)!,
    );
    const sim = new Simulator();
    sim.step(graph);
    const count = () =>
      qOuts.reduce((acc, n, i) => acc + ((sim.values.get(n.id) ? 1 : 0) << i), 0);
    expect(count()).toBe(0);
    for (let pulse = 1; pulse <= 10; pulse++) {
      clk.props.value = 1;
      sim.step(graph);
      clk.props.value = 0;
      sim.step(graph);
      expect(count(), `after pulse ${pulse}`).toBe(pulse % 16);
    }
    // async clear
    const nclr = graph.nodes.find((n) => n.label === '/CLR')!;
    nclr.props.value = 0;
    sim.step(graph);
    expect(count()).toBe(0);
  });
});
