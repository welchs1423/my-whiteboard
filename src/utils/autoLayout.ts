import type { DrawElement } from './elementHelpers';
import { getElementBounds, moveElementBy } from './elementHelpers';

export function distributeHorizontally(elements: DrawElement[], indices: number[]): DrawElement[] {
  const pairs = indices
    .map(i => ({ idx: i, b: getElementBounds(elements[i]) }))
    .filter(p => p.b !== null) as { idx: number; b: NonNullable<ReturnType<typeof getElementBounds>> }[];
  if (pairs.length < 3) return elements;
  pairs.sort((a, b) => a.b.x - b.b.x);
  const totalWidth = pairs.reduce((s, p) => s + p.b.width, 0);
  const span = pairs[pairs.length - 1].b.x + pairs[pairs.length - 1].b.width - pairs[0].b.x;
  const gap = (span - totalWidth) / (pairs.length - 1);
  const upd = [...elements];
  let cursor = pairs[0].b.x;
  pairs.forEach(({ idx, b }, i) => {
    if (i === 0) { cursor = b.x + b.width + gap; return; }
    if (i === pairs.length - 1) return;
    upd[idx] = moveElementBy(upd[idx], cursor - b.x, 0);
    cursor += b.width + gap;
  });
  return upd;
}

export function distributeVertically(elements: DrawElement[], indices: number[]): DrawElement[] {
  const pairs = indices
    .map(i => ({ idx: i, b: getElementBounds(elements[i]) }))
    .filter(p => p.b !== null) as { idx: number; b: NonNullable<ReturnType<typeof getElementBounds>> }[];
  if (pairs.length < 3) return elements;
  pairs.sort((a, b) => a.b.y - b.b.y);
  const totalHeight = pairs.reduce((s, p) => s + p.b.height, 0);
  const span = pairs[pairs.length - 1].b.y + pairs[pairs.length - 1].b.height - pairs[0].b.y;
  const gap = (span - totalHeight) / (pairs.length - 1);
  const upd = [...elements];
  let cursor = pairs[0].b.y;
  pairs.forEach(({ idx, b }, i) => {
    if (i === 0) { cursor = b.y + b.height + gap; return; }
    if (i === pairs.length - 1) return;
    upd[idx] = moveElementBy(upd[idx], 0, cursor - b.y);
    cursor += b.height + gap;
  });
  return upd;
}

export function gridLayout(elements: DrawElement[], indices: number[], cols: number): DrawElement[] {
  if (indices.length === 0) return elements;
  const pairs = indices.map(i => ({ idx: i, b: getElementBounds(elements[i]) })).filter(p => p.b !== null) as { idx: number; b: NonNullable<ReturnType<typeof getElementBounds>> }[];
  if (pairs.length === 0) return elements;
  const gapH = 150, gapV = 120;
  const minX = Math.min(...pairs.map(p => p.b.x));
  const minY = Math.min(...pairs.map(p => p.b.y));
  const upd = [...elements];
  pairs.forEach(({ idx, b }, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const tx = minX + col * gapH;
    const ty = minY + row * gapV;
    upd[idx] = moveElementBy(upd[idx], tx - b.x, ty - b.y);
  });
  return upd;
}

export function treeLayout(elements: DrawElement[], indices: number[]): DrawElement[] {
  // Find connector elements among selected
  const connectors = indices.filter(i => elements[i]?.tool === 'connector');
  if (connectors.length === 0) return gridLayout(elements, indices, Math.ceil(Math.sqrt(indices.length)));

  // Build adjacency
  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();
  connectors.forEach(i => {
    const el = elements[i];
    const from = el.connectorFrom, to = el.connectorTo;
    if (from && to) {
      if (!childrenOf.has(from)) childrenOf.set(from, []);
      childrenOf.get(from)!.push(to);
      hasParent.add(to);
    }
  });

  // Find roots (nodes with no parents)
  const nodeIndices = indices.filter(i => elements[i]?.id && !['connector'].includes(elements[i].tool));
  const roots = nodeIndices.filter(i => {
    const id = elements[i].id!;
    return !hasParent.has(id);
  });
  if (roots.length === 0) return gridLayout(elements, indices, Math.ceil(Math.sqrt(indices.length)));

  const upd = [...elements];
  const idToIdx = new Map<string, number>();
  nodeIndices.forEach(i => { if (elements[i].id) idToIdx.set(elements[i].id!, i); });

  const startX = Math.min(...nodeIndices.map(i => getElementBounds(elements[i])?.x ?? 0));
  const startY = Math.min(...nodeIndices.map(i => getElementBounds(elements[i])?.y ?? 0));
  const hGap = 180, vGap = 100;

  let colOffset = 0;
  roots.forEach(rootIdx => {
    const queue: { id: string; depth: number; col: number }[] = [{ id: elements[rootIdx].id!, depth: 0, col: colOffset }];
    let maxCol = colOffset;
    while (queue.length > 0) {
      const { id, depth, col } = queue.shift()!;
      const idx = idToIdx.get(id);
      if (idx === undefined) continue;
      const b = getElementBounds(elements[idx]);
      if (!b) continue;
      const tx = startX + col * hGap;
      const ty = startY + depth * vGap;
      upd[idx] = moveElementBy(upd[idx], tx - b.x, ty - b.y);
      maxCol = Math.max(maxCol, col);
      const children = childrenOf.get(id) || [];
      children.forEach((childId, ci) => {
        queue.push({ id: childId, depth: depth + 1, col: col + ci });
      });
    }
    colOffset = maxCol + 1;
  });

  return upd;
}
