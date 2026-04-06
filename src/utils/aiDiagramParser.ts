import type { DrawElement } from './elementHelpers';
import { generateId } from './elementHelpers';

const CENTER_X = 600;
const CENTER_Y = 400;

export function parseAIDiagram(text: string): DrawElement[] {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const firstLine = lines[0].toLowerCase();

  // ── flowchart: ──
  if (firstLine.startsWith('flowchart:')) {
    return parseFlowchart(lines.slice(1));
  }

  // ── mindmap: ──
  if (firstLine.startsWith('mindmap:')) {
    return parseMindmap(lines);
  }

  // ── table: NxM ──
  const tableMatch = firstLine.match(/^table:\s*(\d+)\s*x\s*(\d+)/);
  if (tableMatch) {
    const rows = Math.min(parseInt(tableMatch[1]), 10);
    const cols = Math.min(parseInt(tableMatch[2]), 10);
    return [{
      id: generateId(), tool: 'table',
      points: [CENTER_X - 200, CENTER_Y - 100, CENTER_X + 200, CENTER_Y + rows * 40],
      color: '#374151', strokeWidth: 1,
      rows, cols,
      tableData: Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => r === 0 ? `열 ${c + 1}` : '')
      ),
    }];
  }

  // ── A -> B patterns ──
  const arrowPattern = /(.+?)\s*(?:->|→)\s*(.+)/;
  if (lines.some(l => arrowPattern.test(l))) {
    return parseArrowDiagram(lines);
  }

  // ── numbered list: 1. 2. 3. ──
  if (lines.some(l => /^\d+\./.test(l))) {
    return lines
      .filter(l => /^\d+\./.test(l))
      .map((l, i) => {
        const txt = l.replace(/^\d+\.\s*/, '');
        return makeStickyNote(txt, CENTER_X - 80, CENTER_Y + i * 130, '#fef08a');
      });
  }

  // ── bullet list: - or * ──
  if (lines.some(l => /^[-*]/.test(l))) {
    const items = lines.filter(l => /^[-*]/.test(l)).map(l => l.replace(/^[-*]\s*/, ''));
    return items.map((txt, i) => makeStickyNote(txt, CENTER_X - 80, CENTER_Y + i * 130, STICKY_COLORS[i % STICKY_COLORS.length]));
  }

  // ── fallback: one sticky per line ──
  return lines.map((l, i) => makeStickyNote(l, CENTER_X - 80, CENTER_Y + i * 130, STICKY_COLORS[i % STICKY_COLORS.length]));
}

const STICKY_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa'];

function makeStickyNote(text: string, x: number, y: number, bg: string): DrawElement {
  return {
    id: generateId(), tool: 'sticky',
    points: [x, y, x + 160, y + 100],
    color: '#374151', strokeWidth: 1,
    text, stickyBg: bg, fontSize: 14,
  };
}

function makeRect(text: string, x: number, y: number): DrawElement {
  const w = Math.max(120, text.length * 8 + 24);
  return {
    id: generateId(), tool: 'rect',
    points: [x - w / 2, y - 25, x + w / 2, y + 25],
    color: '#3b82f6', strokeWidth: 2, filled: true,
    text, fontSize: 14,
  };
}

function parseArrowDiagram(lines: string[]): DrawElement[] {
  const elements: DrawElement[] = [];
  const nodeMap = new Map<string, { id: string; el: DrawElement }>();
  const arrowPattern = /(.+?)\s*(?:->|→)\s*(.+)/;

  const getOrCreateNode = (label: string, x: number, y: number) => {
    const key = label.trim();
    if (!nodeMap.has(key)) {
      const rectEl = makeRect(key, x, y);
      nodeMap.set(key, { id: rectEl.id!, el: rectEl });
      elements.push(rectEl);
    }
    return nodeMap.get(key)!;
  };

  // Collect unique nodes
  const nodeLabels: string[] = [];
  lines.forEach(line => {
    const m = arrowPattern.exec(line);
    if (m) {
      const from = m[1].trim(), to = m[2].trim();
      if (!nodeLabels.includes(from)) nodeLabels.push(from);
      if (!nodeLabels.includes(to)) nodeLabels.push(to);
    }
  });

  // Position nodes
  nodeLabels.forEach((label, i) => {
    getOrCreateNode(label, CENTER_X + i * 180, CENTER_Y);
  });

  // Create connectors
  lines.forEach(line => {
    const m = arrowPattern.exec(line);
    if (!m) return;
    const from = nodeMap.get(m[1].trim());
    const to = nodeMap.get(m[2].trim());
    if (!from || !to) return;
    elements.push({
      id: generateId(), tool: 'connector',
      points: [0, 0, 0, 0],
      color: '#6b7280', strokeWidth: 2,
      connectorFrom: from.id,
      connectorTo: to.id,
    });
  });

  return elements;
}

function parseFlowchart(lines: string[]): DrawElement[] {
  const elements: DrawElement[] = [];
  const arrowPattern = /(.+?)\s*(?:->|→)\s*(.+)/;
  const nodeMap = new Map<string, string>(); // label -> id
  let nodeIdx = 0;

  const getOrCreate = (label: string) => {
    const key = label.trim();
    if (!nodeMap.has(key)) {
      const col = nodeIdx % 3;
      const row = Math.floor(nodeIdx / 3);
      const x = CENTER_X - 200 + col * 200;
      const y = CENTER_Y - 100 + row * 120;
      const el = makeRect(key, x, y);
      nodeMap.set(key, el.id!);
      elements.push(el);
      nodeIdx++;
    }
    return nodeMap.get(key)!;
  };

  lines.forEach(line => {
    const m = arrowPattern.exec(line);
    if (m) {
      const fromId = getOrCreate(m[1]);
      const toId = getOrCreate(m[2]);
      elements.push({
        id: generateId(), tool: 'connector',
        points: [0, 0, 0, 0],
        color: '#6b7280', strokeWidth: 2,
        connectorFrom: fromId,
        connectorTo: toId,
      });
    } else if (line.trim()) {
      getOrCreate(line.trim());
    }
  });

  return elements;
}

function parseMindmap(lines: string[]): DrawElement[] {
  const elements: DrawElement[] = [];
  const rootLabel = lines[0].replace(/^mindmap:\s*/i, '').trim() || '중심 주제';

  const rootEl: DrawElement = {
    id: generateId(), tool: 'mindmap',
    points: [CENTER_X, CENTER_Y, 160, 50],
    color: '#8b5cf6', strokeWidth: 2,
    mindmapLabel: rootLabel, mindmapLevel: 0,
    mindmapChildren: [],
  };
  elements.push(rootEl);

  const childLines = lines.slice(1).filter(l => l.startsWith('  ') || l.startsWith('\t'));
  childLines.forEach((line, i) => {
    const label = line.trim();
    if (!label) return;
    const angle = (i / Math.max(childLines.length, 1)) * 2 * Math.PI - Math.PI / 2;
    const r = 200;
    const cx = CENTER_X + Math.cos(angle) * r;
    const cy = CENTER_Y + Math.sin(angle) * r;
    const childEl: DrawElement = {
      id: generateId(), tool: 'mindmap',
      points: [cx, cy, 130, 44],
      color: '#3b82f6', strokeWidth: 2,
      mindmapLabel: label, mindmapLevel: 1,
      mindmapParent: rootEl.id,
    };
    elements.push(childEl);
    rootEl.mindmapChildren = [...(rootEl.mindmapChildren || []), childEl.id!];
  });

  return elements;
}
