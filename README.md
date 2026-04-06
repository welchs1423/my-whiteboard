# Real-time Collaborative Whiteboard

<p>
  <img src="https://img.shields.io/badge/React-20232a?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io" alt="Socket.io" />
  <img src="https://img.shields.io/badge/MongoDB-4ea94b?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
</p>

React와 Konva.js 기반의 실시간 협업 화이트보드 웹 애플리케이션입니다.  
Socket.io로 다중 사용자 간 드로잉을 실시간 동기화하고, MongoDB로 캔버스 상태를 영구 저장합니다.

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | React 18, TypeScript, Vite |
| Canvas | Konva.js (react-konva) |
| 상태 관리 | Zustand, useState / useReducer |
| 실시간 통신 | Socket.io (WebSocket) |
| 음성/화면 공유 | WebRTC (native browser API) |
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose) |
| 파일 업로드 | Multer |
| 렌더링 최적화 | useMemo, useCallback 전면 적용 |

---

## 주요 기능

### 드로잉 & 도구
- **펜 도구** — Normal / Marker / Highlighter / Airbrush 4종 브러시, 속도 감응 선 굵기, Douglas-Peucker + Chaikin 스무딩, Smart Shape 자동 인식 (원·삼각형)
- **도형** — 사각형, 원, 삼각형, 직선, 화살표, 베지어 곡선, 커넥터, 도형 라이브러리 6종
- **텍스트** — 리치 텍스트(굵기·기울임·밑줄), 3종 폰트, 정렬, 크기 조절 텍스트박스
- **스티키 메모** — 6가지 배경색, 더블클릭 인라인 편집, 투표 카운터
- **프레임/슬라이드** — 캔버스 영역 지정, PDF 내보내기, 풀스크린 발표 모드

### 고급 기능
- **AI 다이어그램 생성** — 텍스트 설명 파싱으로 플로우차트·마인드맵·화살표 다이어그램 자동 생성
- **손글씨 OCR** — Tesseract.js 기반 펜 획 → 텍스트 변환
- **LaTeX 수식** — KaTeX 렌더링, SVG→Image 캐싱
- **마인드맵** — 클릭으로 루트/자식 노드 추가, 레벨별 색상·곡선 연결선
- **코드 블록** — 언어 선택, 모노스페이스 렌더링
- **이미지 크롭** — 8방향 핸들로 cropX/Y/W/H 조절
- **그라디언트 채우기** — 각도·색상 설정 가능한 선형 그라디언트
- **템플릿 갤러리** — 칸반, 회고, 마인드맵, 와이어프레임, 플로우차트 5종

### 선택 & 편집
- **리사이즈 핸들** — 단일·다중 선택 모두 지원하는 8방향 핸들
- **회전 핸들** — 중심점 기준 자유 회전
- **레이어 관리** — Z순서 조정, 잠금, 가시성 토글, 드래그&드롭 순서 변경
- **정렬 / 자동 레이아웃** — 6방향 정렬, 수평·수직 균등 분산, 격자 배치
- **그룹화** — Ctrl+G 그룹화, 그룹 클릭 시 전체 선택, Ctrl+Shift+G 해제
- **Undo / Redo** — 전체 히스토리 관리, 실시간 동기화 포함

### 협업
- **실시간 동기화** — 변경된 단일 요소만 브로드캐스트하는 증분 동기화
- **커서 공유** — 다른 사용자의 마우스 커서와 닉네임 실시간 표시
- **WebRTC 음성 채팅** — STUN 기반 P2P 오디오, 뮤트/언뮤트 지원
- **화면 공유** — `getDisplayMedia()` + WebRTC 시그널링, 수신 측 플로팅 비디오 오버레이
- **레이저 포인터** — 발표 시 마우스 움직임 실시간 전달
- **커서 DM** — 상대방 커서 클릭으로 귓속말 전송
- **편집 중 표시** — 다른 사용자가 조작 중인 요소에 주황 점선 박스 표시
- **팔로우 모드** — 특정 사용자의 뷰포트를 실시간으로 따라가는 발표자 모드
- **이모지 반응** — 캔버스 클릭 시 1.8초간 플로팅 이모지 브로드캐스트
- **타이머 동기화** — 카운트업/다운 타이머를 협업자 간 동기화

### 뷰 & 탐색
- **무한 캔버스** — 마우스 휠 줌(최대 10배), 스페이스+드래그 패닝
- **핀치 줌** — 터치스크린/트랙패드 2핑거 핀치, 1핑거 패닝
- **줌 슬라이더** — 하단 슬라이더 UI, ±버튼, 단축키
- **Zoom to Fit** — 모든 요소가 화면에 맞도록 자동 줌/위치 조정
- **미니맵** — 전체 캔버스 축소 미리보기
- **요소 검색** — 텍스트 내용으로 요소 검색 후 뷰포트 자동 이동

### 내보내기
- **PNG / SVG / JSON** — 캔버스 내용 다양한 형식으로 저장
- **PDF** — 프레임 기반 멀티 페이지 PDF 내보내기
- **타임라인 프레임 내보내기** — 변경 스냅샷을 순차 PNG 파일로 저장

### 기타
- **영구 저장** — MongoDB 연동, 디바운스 적용 자동 저장
- **다중 방** — URL `?room=방이름` 파라미터로 독립 공간 생성
- **권한 관리** — 방장 시스템, 편집/보기 전용 권한 전환
- **읽기 전용 모드** — 편집 도구 비활성화, 줌·채팅만 가능
- **익명 모드** — 랜덤 동물 이모지 닉네임 자동 생성
- **보드 테마** — 라이트·다크·파스텔·오션 등 8종
- **단축키 커스터마이징** — 클릭 후 키 입력으로 변경, localStorage 저장
- **스냅 가이드라인** — 요소 가장자리·중심선 정렬 시 빨간 가이드라인 + 자동 스냅
- **그리드 스냅** — 28px 격자 자동 스냅 ON/OFF
- **QR 코드 공유** — 현재 방 URL을 QR 이미지로 즉시 생성
- **입장/퇴장 토스트 알림** — 슬라이드 인 알림 UI
- **자동 저장 표시** — `저장 중...` → `저장됨` 인디케이터
- **변경 이력 diff** — 누가 언제 어떤 요소를 추가/수정/삭제했는지 히스토리 패널
- **음성 메모 핀** — MediaRecorder → base64 첨부, 클릭 재생

---

## 프로젝트 구조

```
my-whiteboard/
├── server/
│   └── server.js          # Express + Socket.io 서버, MongoDB 연동
├── src/
│   ├── components/
│   │   ├── Board.tsx          # 메인 캔버스 컴포넌트 (2900+ lines)
│   │   ├── Toolbar.tsx        # 도구 모음
│   │   ├── ChatPanel.tsx      # 실시간 채팅
│   │   ├── LayerPanel.tsx     # 레이어 관리 패널
│   │   ├── FramePanel.tsx     # 프레임/슬라이드 패널
│   │   ├── Minimap.tsx        # 미니맵
│   │   ├── PresentationMode.tsx  # 풀스크린 발표 모드
│   │   ├── TimelinePlayer.tsx # 타임라인 재생기
│   │   ├── VoiceChat.tsx      # WebRTC 음성 채팅
│   │   ├── AIDiagramModal.tsx # AI 다이어그램 생성기
│   │   ├── HistoryDiffPanel.tsx  # 변경 이력 diff
│   │   ├── TemplateGallery.tsx   # 템플릿 갤러리
│   │   ├── ShortcutSettings.tsx  # 단축키 커스터마이징
│   │   ├── ThemeSelector.tsx     # 보드 테마 선택
│   │   └── ...
│   ├── hooks/
│   │   ├── useCanvasEvents.ts    # mouseDown/Move/Up/DblClick 핸들러
│   │   ├── useBoardUI.ts         # 도구·스타일·테마·토스트 상태
│   │   ├── useViewport.ts        # 줌·패닝·좌표 변환
│   │   ├── useHistory.ts         # Undo/Redo 히스토리
│   │   ├── useSocketEvents.ts    # 소켓 이벤트 구독
│   │   └── useKeyboardShortcuts.ts
│   ├── utils/
│   │   ├── elementHelpers.ts     # DrawElement 타입, 바운딩 박스, 리사이즈, 스무딩
│   │   ├── renderElement.tsx     # Konva 요소 렌더러
│   │   ├── aiDiagramParser.ts    # 텍스트 → 다이어그램 파서
│   │   └── autoLayout.ts         # 균등 분산, 격자 배치 알고리즘
│   └── data/
│       ├── boardThemes.ts        # 8종 테마 색상 정의
│       ├── templates.ts          # 5종 프리셋 템플릿
│       └── defaultShortcuts.ts   # 기본 단축키 매핑
└── package.json
```

---

## 시작하기

### 사전 요구 사항
- Node.js 18+
- MongoDB (로컬 또는 Atlas)

### 환경 변수

루트에 `.env` 파일을 생성하세요 (`.env.example` 참고):

```env
MONGODB_URI=mongodb://localhost:27017/whiteboard_db
PORT=3001
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:3001
```

### 설치 및 실행

```bash
# 의존성 설치
npm install
cd server && npm install && cd ..

# 개발 서버 동시 실행
npm run dev          # Vite (프론트엔드) — http://localhost:5173
node server/server.js  # Socket.io 서버 — http://localhost:3001
```

### 빌드

```bash
npm run build
```

---

## 단축키

| 단축키 | 동작 |
|--------|------|
| `P` | 펜 도구 |
| `E` | 지우개 |
| `S` | 선택 도구 |
| `R` | 사각형 |
| `C` | 원 |
| `T` | 텍스트 |
| `L` | 직선 |
| `A` | 화살표 |
| `Ctrl+Z` | 실행 취소 |
| `Ctrl+Y` | 다시 실행 |
| `Ctrl+C / V` | 복사 / 붙여넣기 |
| `Ctrl+D` | 복제 |
| `Ctrl+A` | 전체 선택 |
| `Ctrl+G` | 그룹화 |
| `Ctrl+F` | 요소 검색 |
| `F` | Zoom to Fit |
| `Delete` | 선택 삭제 |
| `?` | 단축키 도움말 |

> 단축키는 설정 패널에서 자유롭게 변경할 수 있습니다.
