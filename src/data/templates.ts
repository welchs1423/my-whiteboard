import type { DrawElement } from '../utils/elementHelpers';
import { generateId } from '../utils/elementHelpers';

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  elements: DrawElement[];
}

const gid1 = generateId();
const gid2 = generateId();
const gid3 = generateId();

export const TEMPLATES: BoardTemplate[] = [
  {
    id: 'kanban',
    name: '칸반 보드',
    description: 'To Do / In Progress / Done 컬럼',
    thumbnail: '📋',
    elements: [
      { id: generateId(), tool: 'frame', points: [50, 80, 350, 680], color: '#6366f1', strokeWidth: 2, frameTitle: 'To Do' },
      { id: generateId(), tool: 'frame', points: [380, 80, 680, 680], color: '#f59e0b', strokeWidth: 2, frameTitle: 'In Progress' },
      { id: generateId(), tool: 'frame', points: [710, 80, 1010, 680], color: '#22c55e', strokeWidth: 2, frameTitle: 'Done' },
      { id: generateId(), tool: 'sticky', points: [70, 110, 330, 200], color: '#ca8a04', strokeWidth: 1, stickyBg: '#fef08a', text: '기능 A 개발', opacity: 1 },
      { id: generateId(), tool: 'sticky', points: [70, 220, 330, 310], color: '#ca8a04', strokeWidth: 1, stickyBg: '#bbf7d0', text: '디자인 검토', opacity: 1 },
      { id: generateId(), tool: 'sticky', points: [400, 110, 660, 200], color: '#ca8a04', strokeWidth: 1, stickyBg: '#bfdbfe', text: '코드 리뷰', opacity: 1 },
      { id: generateId(), tool: 'sticky', points: [730, 110, 990, 200], color: '#ca8a04', strokeWidth: 1, stickyBg: '#fecaca', text: '배포 완료', opacity: 1 },
    ],
  },
  {
    id: 'retro',
    name: '회고 보드',
    description: '4섹션 회고 보드 템플릿',
    thumbnail: '🔄',
    elements: [
      { id: generateId(), tool: 'frame', points: [50, 50, 500, 380], color: '#22c55e', strokeWidth: 2, frameTitle: '잘한 점 👍' },
      { id: generateId(), tool: 'frame', points: [520, 50, 970, 380], color: '#ef4444', strokeWidth: 2, frameTitle: '개선할 점 🔧' },
      { id: generateId(), tool: 'frame', points: [50, 400, 500, 730], color: '#3b82f6', strokeWidth: 2, frameTitle: '시도할 것 💡' },
      { id: generateId(), tool: 'frame', points: [520, 400, 970, 730], color: '#f59e0b', strokeWidth: 2, frameTitle: '감사한 것 🙏' },
      { id: generateId(), tool: 'sticky', points: [70, 80, 330, 170], color: '#ca8a04', strokeWidth: 1, stickyBg: '#bbf7d0', text: '팀워크가 좋았다', opacity: 1 },
      { id: generateId(), tool: 'sticky', points: [540, 80, 800, 170], color: '#ca8a04', strokeWidth: 1, stickyBg: '#fecaca', text: '소통 부재', opacity: 1 },
    ],
  },
  {
    id: 'mindmap',
    name: '마인드맵',
    description: '기본 마인드맵 구조',
    thumbnail: '🧠',
    elements: [
      { id: gid1, tool: 'mindmap', points: [500, 350, 160, 50], color: '#8b5cf6', strokeWidth: 2, mindmapLabel: '중심 주제', mindmapLevel: 0, mindmapChildren: [gid2, gid3] },
      { id: gid2, tool: 'mindmap', points: [750, 250, 130, 44], color: '#3b82f6', strokeWidth: 2, mindmapLabel: '아이디어 1', mindmapLevel: 1, mindmapParent: gid1 },
      { id: gid3, tool: 'mindmap', points: [750, 450, 130, 44], color: '#3b82f6', strokeWidth: 2, mindmapLabel: '아이디어 2', mindmapLevel: 1, mindmapParent: gid1 },
    ],
  },
  {
    id: 'wireframe',
    name: '와이어프레임',
    description: '기본 앱 화면 레이아웃',
    thumbnail: '📱',
    elements: [
      { id: generateId(), tool: 'rect', points: [100, 50, 500, 100], color: '#6366f1', strokeWidth: 2, filled: true, opacity: 0.8 },
      { id: generateId(), tool: 'text', points: [120, 65], color: 'white', strokeWidth: 2, text: '앱 헤더', fontSize: 20 },
      { id: generateId(), tool: 'rect', points: [100, 110, 200, 700], color: '#e5e7eb', strokeWidth: 1, filled: true, opacity: 0.5 },
      { id: generateId(), tool: 'rect', points: [210, 110, 500, 700], color: '#f9fafb', strokeWidth: 1, filled: true, opacity: 0.5 },
      { id: generateId(), tool: 'text', points: [115, 130], color: '#6b7280', strokeWidth: 1, text: '메뉴', fontSize: 14 },
      { id: generateId(), tool: 'rect', points: [220, 120, 490, 200], color: '#d1fae5', strokeWidth: 1, filled: true },
      { id: generateId(), tool: 'text', points: [235, 140], color: '#065f46', strokeWidth: 1, text: '콘텐츠 블록 1', fontSize: 14 },
      { id: generateId(), tool: 'rect', points: [220, 210, 490, 290], color: '#dbeafe', strokeWidth: 1, filled: true },
      { id: generateId(), tool: 'text', points: [235, 230], color: '#1e40af', strokeWidth: 1, text: '콘텐츠 블록 2', fontSize: 14 },
    ],
  },
  {
    id: 'flowchart',
    name: '플로우차트',
    description: '기본 흐름도 템플릿',
    thumbnail: '🔀',
    elements: [
      { id: generateId(), tool: 'rect', points: [350, 50, 550, 110], color: '#22c55e', strokeWidth: 2, filled: true },
      { id: generateId(), tool: 'text', points: [383, 68], color: 'white', strokeWidth: 1, text: '시작', fontSize: 18 },
      { id: generateId(), tool: 'arrow', points: [450, 110, 450, 160], color: '#374151', strokeWidth: 2 },
      { id: generateId(), tool: 'shape', points: [330, 160, 570, 260], color: '#f59e0b', strokeWidth: 2, filled: true, shapeName: 'diamond' },
      { id: generateId(), tool: 'text', points: [388, 196], color: 'white', strokeWidth: 1, text: '조건?', fontSize: 16 },
      { id: generateId(), tool: 'arrow', points: [450, 260, 450, 310], color: '#374151', strokeWidth: 2 },
      { id: generateId(), tool: 'text', points: [455, 275], color: '#374151', strokeWidth: 1, text: 'Yes', fontSize: 12 },
      { id: generateId(), tool: 'rect', points: [350, 310, 550, 370], color: '#3b82f6', strokeWidth: 2, filled: true },
      { id: generateId(), tool: 'text', points: [370, 328], color: 'white', strokeWidth: 1, text: '처리 단계', fontSize: 16 },
      { id: generateId(), tool: 'arrow', points: [450, 370, 450, 420], color: '#374151', strokeWidth: 2 },
      { id: generateId(), tool: 'rect', points: [350, 420, 550, 480], color: '#ef4444', strokeWidth: 2, filled: true },
      { id: generateId(), tool: 'text', points: [393, 438], color: 'white', strokeWidth: 1, text: '종료', fontSize: 18 },
    ],
  },
];
