export interface ShortcutDef {
  id: string;
  label: string;
  defaultKey: string;
  category: 'tool' | 'edit' | 'view';
}

export const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  { id: 'pen',       label: '펜 도구',       defaultKey: 'p', category: 'tool' },
  { id: 'eraser',    label: '지우개',         defaultKey: 'e', category: 'tool' },
  { id: 'rect',      label: '사각형',         defaultKey: 'r', category: 'tool' },
  { id: 'circle',    label: '원',             defaultKey: 'c', category: 'tool' },
  { id: 'text',      label: '텍스트',         defaultKey: 't', category: 'tool' },
  { id: 'straight',  label: '직선',           defaultKey: 'l', category: 'tool' },
  { id: 'arrow',     label: '화살표',         defaultKey: 'a', category: 'tool' },
  { id: 'select',    label: '선택',           defaultKey: 's', category: 'tool' },
  { id: 'sticky',    label: '스티커 메모',    defaultKey: 'n', category: 'tool' },
  { id: 'triangle',  label: '삼각형',         defaultKey: 'v', category: 'tool' },
  { id: 'table',     label: '테이블',         defaultKey: 'b', category: 'tool' },
  { id: 'mindmap',   label: '마인드맵',       defaultKey: 'm', category: 'tool' },
  { id: 'zoomFit',   label: '전체 보기',      defaultKey: 'f', category: 'view' },
  { id: 'zoomIn',    label: '확대',           defaultKey: '=', category: 'view' },
  { id: 'zoomOut',   label: '축소',           defaultKey: '-', category: 'view' },
];
