/**
 * Builds the data needed to animate a Dijkstra shortest-path search over the
 * real road network, from the driver (source) to the patient (target).
 *
 * Returns:
 *  - `exploreSegments` : ordered list of 2-point road segments, in the order
 *                        Dijkstra settled them → replaying this is the flood-fill.
 *  - `path`            : the final shortest path as [lng, lat][].
 *  - `source`/`target` : snapped graph node coordinates.
 *
 * Everything degrades gracefully (synthetic mesh + straight-line path) so a
 * caller can always animate something without crashing.
 */

import { buildRoadGraph, nearestNode } from './roadGraph';
import { runDijkstra, reconstructPath } from './dijkstra';

export interface DijkstraViz {
  exploreSegments: [number, number][][];
  path: [number, number][];
  source: [number, number];
  target: [number, number];
  synthetic: boolean;
  reached: boolean;
}

// Keep the animated edge count sane on very dense city graphs.
const MAX_SEGMENTS = 9000;

export async function computeDijkstraViz(
  from: [number, number], // [lng, lat] driver
  to: [number, number], // [lng, lat] patient
  signal?: AbortSignal
): Promise<DijkstraViz> {
  const graph = await buildRoadGraph(from, to, signal);

  const s = nearestNode(graph, from[0], from[1]);
  const t = nearestNode(graph, to[0], to[1]);

  const { settleOrder, prev, reached } = runDijkstra(graph.adj, graph.n, s, t);

  // Build the flood: each settled node contributes the tree edge prev→node.
  let segs: [number, number][][] = [];
  for (const node of settleOrder) {
    const p = prev[node];
    if (p >= 0) segs.push([graph.coords[p], graph.coords[node]]);
  }

  // Subsample if the flood is enormous (keeps the animation smooth).
  if (segs.length > MAX_SEGMENTS) {
    const step = Math.ceil(segs.length / MAX_SEGMENTS);
    segs = segs.filter((_, i) => i % step === 0);
  }

  // Final shortest path.
  const idxPath = reconstructPath(prev, s, t);
  let path: [number, number][] = idxPath.map((i) => graph.coords[i]);
  if (path.length < 2) {
    // Unreachable / degenerate → straight line so the route still draws.
    path = [from, to];
  }

  return {
    exploreSegments: segs,
    path,
    source: graph.coords[s] ?? from,
    target: graph.coords[t] ?? to,
    synthetic: graph.synthetic,
    reached,
  };
}
