/**
 * Dijkstra's shortest-path algorithm over a weighted graph.
 *
 * Designed for the route-search visualisation: besides the final path it
 * records the *order in which nodes are settled* (popped from the priority
 * queue with their final distance). Replaying that order produces the classic
 * "flood-fill" expansion you see in Dijkstra animations.
 *
 * Graph representation (chosen for speed in the browser):
 *   - `coords[i]`  → [lng, lat] of node i
 *   - `adj[i]`     → flat array [neighbor0, weight0, neighbor1, weight1, ...]
 */

export interface DijkstraResult {
  /** Node indices in the order they were settled (source first). */
  settleOrder: number[];
  /** Predecessor of each node on the shortest-path tree (-1 if none). */
  prev: Int32Array;
  /** Whether the target was reached. */
  reached: boolean;
}

/** Binary min-heap keyed by distance. Stores (distance, node) pairs. */
class MinHeap {
  private dist: number[] = [];
  private node: number[] = [];

  get size(): number {
    return this.node.length;
  }

  push(d: number, n: number): void {
    this.dist.push(d);
    this.node.push(n);
    let i = this.node.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.dist[parent] <= this.dist[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): { d: number; n: number } {
    const d = this.dist[0];
    const n = this.node[0];
    const lastD = this.dist.pop()!;
    const lastN = this.node.pop()!;
    if (this.node.length > 0) {
      this.dist[0] = lastD;
      this.node[0] = lastN;
      this.bubbleDown(0);
    }
    return { d, n };
  }

  private bubbleDown(i: number): void {
    const len = this.node.length;
    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;
      if (left < len && this.dist[left] < this.dist[smallest]) smallest = left;
      if (right < len && this.dist[right] < this.dist[smallest]) smallest = right;
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(a: number, b: number): void {
    const td = this.dist[a];
    this.dist[a] = this.dist[b];
    this.dist[b] = td;
    const tn = this.node[a];
    this.node[a] = this.node[b];
    this.node[b] = tn;
  }
}

/**
 * Run Dijkstra from `source` until `target` is settled (or the reachable
 * component is exhausted).
 *
 * @param adj    flat adjacency lists (see file header)
 * @param n      number of nodes
 * @param source source node index
 * @param target target node index
 */
export function runDijkstra(
  adj: number[][],
  n: number,
  source: number,
  target: number
): DijkstraResult {
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const settled = new Uint8Array(n);
  const settleOrder: number[] = [];

  if (source < 0 || source >= n) {
    return { settleOrder, prev, reached: false };
  }

  dist[source] = 0;
  const heap = new MinHeap();
  heap.push(0, source);

  let reached = false;

  while (heap.size > 0) {
    const { d, n: u } = heap.pop();
    if (settled[u]) continue; // stale heap entry
    settled[u] = 1;
    settleOrder.push(u);

    if (u === target) {
      reached = true;
      break; // flood has reached the patient — stop expanding
    }

    const list = adj[u];
    if (!list) continue;
    for (let k = 0; k < list.length; k += 2) {
      const v = list[k];
      const w = list[k + 1];
      if (settled[v]) continue;
      const nd = d + w;
      if (nd < dist[v]) {
        dist[v] = nd;
        prev[v] = u;
        heap.push(nd, v);
      }
    }
  }

  return { settleOrder, prev, reached };
}

/**
 * Reconstruct the shortest path (as node indices) from `prev` chain.
 * Returns [] if the target is unreachable.
 */
export function reconstructPath(prev: Int32Array, source: number, target: number): number[] {
  const path: number[] = [];
  let cur = target;
  // Guard against broken chains / cycles.
  let guard = prev.length + 1;
  while (cur !== -1 && guard-- > 0) {
    path.push(cur);
    if (cur === source) break;
    cur = prev[cur];
  }
  if (path.length === 0 || path[path.length - 1] !== source) return [];
  return path.reverse();
}
