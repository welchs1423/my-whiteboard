import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Rect, Ellipse, Text, Arrow } from 'react-konva';
import Konva from 'konva';
import { Eraser, Pen, Trash2, Download, Users, MessageSquare, Send, Square, Circle, Undo2, Redo2, Type, ArrowRight, Minus } from 'lucide-react';
import { io } from 'socket.io-client';

// 서버 연결 설정
const socket = io('http://localhost:3001');

type ToolType = 'pen' | 'eraser' | 'rect' | 'circle' | 'text' | 'arrow' | 'straight';

interface DrawElement {
  tool: ToolType;
  points: number[];
  color: string;
  strokeWidth: number;
  text?: string;    // 텍스트 도구 전용
  fontSize?: number; // 텍스트 도구 전용
}

interface TextInputState {
  x: number;
  y: number;
  value: string;
}

interface ChatMessage {
  text: string;
  sender: string;
  time: string;
}

const COLORS = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];

export default function Board() {
  // --- 상태 관리 ---
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [nickname, setNickname] = useState<string>('');
  const [elements, setElements] = useState<DrawElement[]>([]);
  const [currentColor, setCurrentColor] = useState<string>(COLORS[0]);
  const [tool, setTool] = useState<ToolType>('pen');
  const [strokeWidth, setStrokeWidth] = useState<number>(5);
  const [users, setUsers] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [textInput, setTextInput] = useState<TextInputState | null>(null);

  // --- Ref 설정 ---
  const isDrawing = useRef(false);
  const stageRef = useRef<Konva.Stage>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<DrawElement[][]>([[]]); // 히스토리 스택 (초기값: 빈 캔버스)
  const historyStepRef = useRef(0);                 // 현재 히스토리 위치


  // --- Undo / Redo ---
  const handleUndo = () => {
    if (historyStepRef.current <= 0) return;
    historyStepRef.current--;
    const prev = historyRef.current[historyStepRef.current];
    setElements([...prev]);
    socket.emit('draw_line', prev);
  };

  const handleRedo = () => {
    if (historyStepRef.current >= historyRef.current.length - 1) return;
    historyStepRef.current++;
    const next = historyRef.current[historyStepRef.current];
    setElements([...next]);
    socket.emit('draw_line', next);
  };

  // 키보드 단축키 (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 텍스트 입력 중에는 단축키 무시
      if (textareaRef.current === document.activeElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- 소켓 이벤트 리스너 ---
  useEffect(() => {
    socket.on('draw_line', (incoming: DrawElement[]) => setElements(incoming));
    socket.on('clear_all', () => {
      setElements([]);
      historyRef.current = [[]];
      historyStepRef.current = 0;
    });
    socket.on('user_list', (incomingUsers: string[]) => setUsers(incomingUsers));
    socket.on('receive_message', (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.off('draw_line');
      socket.off('clear_all');
      socket.off('user_list');
      socket.off('receive_message');
    };
  }, []);

  // 채팅 자동 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- 핸들러 함수 ---
  const handleJoin = () => {
    if (nickname.trim() === '') return;
    socket.emit('set_nickname', nickname);
    setIsJoined(true);
  };

  const handleSendMessage = () => {
    if (inputText.trim() === '') return;
    const messageData: ChatMessage = {
      text: inputText,
      sender: nickname,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    socket.emit('send_message', messageData);
    setInputText('');
  };

  const handleClearAll = () => {
    setElements([]);
    historyRef.current = [[]];
    historyStepRef.current = 0;
    socket.emit('clear_all');
  };

  const handleDownload = () => {
    if (!stageRef.current) return;
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 텍스트 확정: 히스토리 저장 + 소켓 발행 ---
  const commitText = () => {
    if (!textInput || !textInput.value.trim()) {
      setTextInput(null);
      return;
    }
    const fontSize = Math.max(12, strokeWidth * 3);
    const newEl: DrawElement = {
      tool: 'text',
      points: [textInput.x, textInput.y],
      color: currentColor,
      strokeWidth,
      text: textInput.value,
      fontSize,
    };
    setElements((prev) => {
      const updated = [...prev, newEl];
      const newHistory = historyRef.current.slice(0, historyStepRef.current + 1);
      newHistory.push([...updated]);
      historyRef.current = newHistory;
      historyStepRef.current = newHistory.length - 1;
      socket.emit('draw_line', updated);
      return updated;
    });
    setTextInput(null);
  };

  // --- 캔버스 마우스 이벤트 ---
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;

    // 텍스트 도구: 클릭 위치에 입력창 표시 (기존 텍스트 먼저 확정)
    if (tool === 'text') {
      commitText();
      setTextInput({ x: pos.x, y: pos.y, value: '' });
      return;
    }

    isDrawing.current = true;
    const newEl: DrawElement = {
      tool,
      // 펜/지우개: 시작점만, 도형: 시작점+끝점(동일) 4개 값
      points: tool === 'pen' || tool === 'eraser'
        ? [pos.x, pos.y]
        : [pos.x, pos.y, pos.x, pos.y],
      color: currentColor,
      strokeWidth,
    };
    setElements((prev) => [...prev, newEl]);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing.current) return;
    const point = e.target.getStage()?.getPointerPosition();
    if (!point) return;

    setElements((prev) => {
      const updated = [...prev];
      const last = { ...updated[updated.length - 1] };

      if (last.tool === 'pen' || last.tool === 'eraser') {
        // 펜/지우개: 점 추가
        last.points = [...last.points, point.x, point.y];
      } else {
        // 도형: 끝점만 업데이트 (시작점 고정)
        last.points = [last.points[0], last.points[1], point.x, point.y];
      }

      updated[updated.length - 1] = last;
      socket.emit('draw_line', updated);
      return updated;
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    // setState 콜백으로 최신 elements 읽어 히스토리에 저장
    setElements((latest) => {
      const newHistory = historyRef.current.slice(0, historyStepRef.current + 1);
      newHistory.push([...latest]);
      historyRef.current = newHistory;
      historyStepRef.current = newHistory.length - 1;
      return latest;
    });
  };

  // --- 엘리먼트 렌더링 ---
  const renderElement = (el: DrawElement, i: number) => {
    if (el.tool === 'pen' || el.tool === 'eraser') {
      return (
        <Line
          key={i}
          points={el.points}
          stroke={el.color}
          strokeWidth={el.strokeWidth}
          tension={0.5}
          lineCap="round"
          lineJoin="round"
          globalCompositeOperation={el.tool === 'eraser' ? 'destination-out' : 'source-over'}
        />
      );
    }
    if (el.tool === 'rect' && el.points.length >= 4) {
      const x = Math.min(el.points[0], el.points[2]);
      const y = Math.min(el.points[1], el.points[3]);
      const width = Math.abs(el.points[2] - el.points[0]);
      const height = Math.abs(el.points[3] - el.points[1]);
      return (
        <Rect key={i} x={x} y={y} width={width} height={height}
          stroke={el.color} strokeWidth={el.strokeWidth} />
      );
    }
    if (el.tool === 'circle' && el.points.length >= 4) {
      const cx = (el.points[0] + el.points[2]) / 2;
      const cy = (el.points[1] + el.points[3]) / 2;
      const rx = Math.abs(el.points[2] - el.points[0]) / 2;
      const ry = Math.abs(el.points[3] - el.points[1]) / 2;
      return (
        <Ellipse key={i} x={cx} y={cy} radiusX={rx} radiusY={ry}
          stroke={el.color} strokeWidth={el.strokeWidth} />
      );
    }
    if (el.tool === 'text' && el.text) {
      return (
        <Text
          key={i}
          x={el.points[0]}
          y={el.points[1]}
          text={el.text}
          fontSize={el.fontSize || 20}
          fill={el.color}
          fontFamily="sans-serif"
        />
      );
    }
    if (el.tool === 'straight' && el.points.length >= 4) {
      return (
        <Line
          key={i}
          points={[el.points[0], el.points[1], el.points[2], el.points[3]]}
          stroke={el.color}
          strokeWidth={el.strokeWidth}
          lineCap="round"
        />
      );
    }
    if (el.tool === 'arrow' && el.points.length >= 4) {
      return (
        <Arrow
          key={i}
          points={[el.points[0], el.points[1], el.points[2], el.points[3]]}
          stroke={el.color}
          strokeWidth={el.strokeWidth}
          fill={el.color}
          pointerLength={12}
          pointerWidth={10}
        />
      );
    }
    return null;
  };

  // 커서 스타일
  const getCursor = () => {
    if (tool === 'eraser') return 'cell';
    if (tool === 'text') return 'text';
    return 'crosshair';
  };

  // --- 렌더링: 입장 화면 ---
  if (!isJoined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6' }}>
        <div style={{ padding: '30px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '15px', width: '300px' }}>
          <h2 style={{ margin: 0, textAlign: 'center', color: '#374151' }}>화이트보드 입장</h2>
          <input
            type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="닉네임을 입력하세요"
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
          />
          <button onClick={handleJoin} style={{ padding: '10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            입장하기
          </button>
        </div>
      </div>
    );
  }

  // --- 렌더링: 메인 화이트보드 ---
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#f9fafb' }}>

      {/* 상단 도구 모음 */}
      <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', gap: '15px', padding: '10px 20px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', alignItems: 'center' }}>

        {/* 그리기 도구 */}
        <div style={{ display: 'flex', gap: '10px', borderRight: '2px solid #e5e7eb', paddingRight: '15px' }}>
          <button onClick={() => setTool('pen')} title="펜" style={{ background: 'none', border: 'none', cursor: 'pointer', color: tool === 'pen' ? '#3b82f6' : '#9ca3af' }}><Pen size={24} /></button>
          <button onClick={() => setTool('eraser')} title="지우개" style={{ background: 'none', border: 'none', cursor: 'pointer', color: tool === 'eraser' ? '#3b82f6' : '#9ca3af' }}><Eraser size={24} /></button>
          <button onClick={() => setTool('rect')} title="사각형" style={{ background: 'none', border: 'none', cursor: 'pointer', color: tool === 'rect' ? '#3b82f6' : '#9ca3af' }}><Square size={24} /></button>
          <button onClick={() => setTool('circle')} title="원" style={{ background: 'none', border: 'none', cursor: 'pointer', color: tool === 'circle' ? '#3b82f6' : '#9ca3af' }}><Circle size={24} /></button>
          <button onClick={() => setTool('text')} title="텍스트" style={{ background: 'none', border: 'none', cursor: 'pointer', color: tool === 'text' ? '#3b82f6' : '#9ca3af' }}><Type size={24} /></button>
          <button onClick={() => setTool('straight')} title="직선" style={{ background: 'none', border: 'none', cursor: 'pointer', color: tool === 'straight' ? '#3b82f6' : '#9ca3af' }}><Minus size={24} /></button>
          <button onClick={() => setTool('arrow')} title="화살표" style={{ background: 'none', border: 'none', cursor: 'pointer', color: tool === 'arrow' ? '#3b82f6' : '#9ca3af' }}><ArrowRight size={24} /></button>
        </div>

        {/* 색상 팔레트 + 커스텀 색상 피커 */}
        <div style={{ display: 'flex', gap: '10px', borderRight: '2px solid #e5e7eb', paddingRight: '15px', alignItems: 'center' }}>
          {COLORS.map((color) => (
            <button key={color} onClick={() => { setCurrentColor(color); if (tool === 'eraser') setTool('pen'); }}
              style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: color, border: currentColor === color && tool !== 'eraser' ? '3px solid #3b82f6' : '1px solid #e5e7eb', cursor: 'pointer' }} />
          ))}
          {/* 커스텀 색상 피커 */}
          <label title="커스텀 색상" style={{ position: 'relative', width: '24px', height: '24px', cursor: 'pointer' }}>
            <input
              type="color"
              value={currentColor}
              onChange={(e) => { setCurrentColor(e.target.value); if (tool === 'eraser') setTool('pen'); }}
              style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', top: 0, left: 0 }}
            />
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%',
              background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
              border: !COLORS.includes(currentColor) && tool !== 'eraser' ? '3px solid #3b82f6' : '1px solid #e5e7eb',
            }} />
          </label>
        </div>

        {/* 굵기 / 글자 크기 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderRight: '2px solid #e5e7eb', paddingRight: '15px' }}>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>{tool === 'text' ? '크기' : '굵기'}</span>
          <input type="range" min="1" max="50" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} />
          {tool === 'text' && (
            <span style={{ fontSize: '11px', color: '#9ca3af', minWidth: '30px' }}>{Math.max(12, strokeWidth * 3)}px</span>
          )}
        </div>

        {/* Undo / Redo / 저장 / 전체지우기 */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={handleUndo} title="실행 취소 (Ctrl+Z)" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><Undo2 size={24} /></button>
          <button onClick={handleRedo} title="다시 실행 (Ctrl+Y)" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><Redo2 size={24} /></button>
          <button onClick={handleDownload} title="저장" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><Download size={24} /></button>
          <button onClick={handleClearAll} title="전체 지우기" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={24} /></button>
        </div>
      </div>

      {/* 우측 접속자 목록 */}
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10, backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '150px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>
          <Users size={18} /> 온라인 ({users.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {users.map((u, i) => (
            <div key={i} style={{ fontSize: '13px', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} /> {u}
            </div>
          ))}
        </div>
      </div>

      {/* 우측 하단 채팅창 */}
      <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 10, width: '280px', height: '350px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}><MessageSquare size={18} /> 채팅</div>
        <div style={{ flex: 1, padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ alignSelf: msg.sender === nickname ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
              <div style={{ fontSize: '10px', color: '#9ca3af', textAlign: msg.sender === nickname ? 'right' : 'left' }}>{msg.sender}</div>
              <div style={{ padding: '6px 10px', borderRadius: '10px', fontSize: '13px', backgroundColor: msg.sender === nickname ? '#3b82f6' : '#f3f4f6', color: msg.sender === nickname ? 'white' : '#374151' }}>{msg.text}</div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div style={{ padding: '10px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '5px' }}>
          <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="메시지..." style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }} />
          <button onClick={handleSendMessage} style={{ padding: '6px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><Send size={16} /></button>
        </div>
      </div>

      {/* 텍스트 입력 오버레이 */}
      {textInput && (
        <textarea
          ref={textareaRef}
          value={textInput.value}
          autoFocus
          onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commitText();
            }
            if (e.key === 'Escape') {
              setTextInput(null);
            }
          }}
          placeholder="텍스트 입력 후 Enter"
          style={{
            position: 'absolute',
            left: textInput.x,
            top: textInput.y,
            zIndex: 20,
            background: 'transparent',
            border: '1px dashed #3b82f6',
            outline: 'none',
            resize: 'none',
            overflow: 'hidden',
            minWidth: '120px',
            minHeight: `${Math.max(12, strokeWidth * 3) + 10}px`,
            fontSize: `${Math.max(12, strokeWidth * 3)}px`,
            fontFamily: 'sans-serif',
            color: currentColor,
            lineHeight: '1.4',
            padding: '2px 4px',
            caretColor: currentColor,
          }}
          rows={1}
        />
      )}

      {/* 캔버스 영역 */}
      <Stage
        ref={stageRef}
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ cursor: getCursor() }}
      >
        <Layer>
          {elements.map(renderElement)}
        </Layer>
      </Stage>
    </div>
  );
}
