import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import Konva from 'konva';
import { Eraser, Pen, Trash2, Download, Users, MessageSquare, Send } from 'lucide-react';
import { io } from 'socket.io-client';

// 서버 연결 설정
const socket = io('http://localhost:3001');

interface LineData {
  tool: string;
  points: number[];
  color: string;
  strokeWidth: number;
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
  const [lines, setLines] = useState<LineData[]>([]);
  const [currentColor, setCurrentColor] = useState<string>(COLORS[0]);
  const [tool, setTool] = useState<string>('pen');
  const [strokeWidth, setStrokeWidth] = useState<number>(5);
  const [users, setUsers] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');

  // --- Ref 설정 ---
  const isDrawing = useRef(false);
  const stageRef = useRef<Konva.Stage>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- 소켓 이벤트 리스너 ---
  useEffect(() => {
    socket.on('draw_line', (incomingLines: LineData[]) => setLines(incomingLines));
    socket.on('clear_all', () => setLines([]));
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
    setLines([]);
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

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    isDrawing.current = true;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    setLines([...lines, { tool, points: [pos.x, pos.y], color: currentColor, strokeWidth }]);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing.current) return;
    const stage = e.target.getStage();
    const point = stage?.getPointerPosition();
    if (!point) return;
    const lastLine = { ...lines[lines.length - 1] };
    lastLine.points = lastLine.points.concat([point.x, point.y]);
    const newLines = [...lines];
    newLines.splice(lines.length - 1, 1, lastLine);
    setLines(newLines);
    socket.emit('draw_line', newLines);
  };

  const handleMouseUp = () => (isDrawing.current = false);

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
        <div style={{ display: 'flex', gap: '10px', borderRight: '2px solid #e5e7eb', paddingRight: '15px' }}>
          <button onClick={() => setTool('pen')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tool === 'pen' ? '#3b82f6' : '#9ca3af' }}><Pen size={24} /></button>
          <button onClick={() => setTool('eraser')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tool === 'eraser' ? '#3b82f6' : '#9ca3af' }}><Eraser size={24} /></button>
        </div>
        <div style={{ display: 'flex', gap: '10px', borderRight: '2px solid #e5e7eb', paddingRight: '15px' }}>
          {COLORS.map((color) => (
            <button key={color} onClick={() => { setCurrentColor(color); setTool('pen'); }} style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: color, border: currentColor === color && tool === 'pen' ? '2px solid #3b82f6' : '1px solid #e5e7eb', cursor: 'pointer' }} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderRight: '2px solid #e5e7eb', paddingRight: '15px' }}>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>굵기</span>
          <input type="range" min="1" max="50" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleDownload} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }} title="저장"><Download size={24} /></button>
          <button onClick={handleClearAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="전체지우기"><Trash2 size={24} /></button>
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

      {/* 캔버스 영역 */}
      <Stage
        ref={stageRef}
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <Layer>
          {lines.map((line, i) => (
            <Line
              key={i}
              points={line.points}
              stroke={line.color}
              strokeWidth={line.strokeWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation={line.tool === 'eraser' ? 'destination-out' : 'source-over'}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}