# 🎨 Real-time Whiteboard

React와 Konva.js를 활용한 실시간 협업 화이트보드 토이 프로젝트입니다.

## 🚀 Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Graphics:** Konva.js (react-konva)
- **State Management:** Zustand
- **Real-time:** Socket.io-client, Node.js, Express

## ✨ Features

- [x] **기본 드로잉:** 마우스 드래그를 이용한 캔버스 자유선 그리기
- [x] **색상 팔레트 & 지우개:** 선 색상 변경 및 개별 지우개 툴 구현
- [x] **선 굵기 조절:** 슬라이더를 이용한 펜과 지우개의 굵기 동적 변경 기능
- [x] **실시간 동기화 (Multiplayer):** Socket.io를 이용한 다중 접속자 간 드로잉 실시간 공유
- [x] **전체 지우기:** 캔버스 초기화 및 실시간 동기화
- [x] **이미지 다운로드:** 현재 캔버스 내용을 PNG 파일로 저장 기능
- [x] **접속자 목록:** 실시간 온라인 사용자 목록 및 인원수 표시 기능 추가
- [x] **닉네임 설정:** 접속 시 사용자 식별을 위한 닉네임 입력 기능 추가
- [x] **실시간 채팅:** 접속자 간 텍스트 메시지를 주고받을 수 있는 채팅창 구현
