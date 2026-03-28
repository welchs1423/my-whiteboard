import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import Konva from 'konva';
import { Eraser, Pen, Trash2, Download, Users } from 'lucide-react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

interface LineData {
  tool: string;
  points: number[];
  color: string;
}

const COLORS = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];

export default function Board() {
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [nickname, setNickname] = useState<string>('');
  
  const [lines, setLines] = useState<LineData[]>([]);
  const [currentColor, setCurrentColor] = useState<string>(COLORS[0]);
  const [tool, setTool] = useState<string>('pen');
  const [users, setUsers] = useState<string[]>([]);
  
  const isDrawing = useRef(false);
  const stageRef = useRef<Konva.Stage>(null); 

  useEffect(() => {
    socket.on('draw_line', (incomingLines: LineData[]) => {
      setLines(incomingLines);
    });

    socket.on('clear_all', () => {
      setLines([]);
    });

    socket.on('user_list', (incomingUsers: string[]) => {
      setUsers(incomingUsers);
    });

    return () => {
      socket.off('draw_line');
      socket.off('clear_all');
      socket.off('user_list');
    };
  }, []);

  // 닉네임 설정 및 입장 처리
  const handleJoin = () => {
    if (nickname.trim() === '') return;
    socket.emit('set_nickname', nickname);
    setIsJoined(true);
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
    setLines([...lines, { tool, points: [pos.x, pos.y], color: currentColor }]); 
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

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  // 입장 전 렌더링 화면
  if (!isJoined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6' }}>
        <div style={{ padding: '30px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '15px', width: '300px' }}>
          <h2 style={{ margin: 0, textAlign: 'center', color: '#374151' }}>화이트보드 입장</h2>
          <input 
            type="text" 
            placeholder="사용할 닉네임을 입력하세요" 
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none' }}
          />
          <button 
            onClick={handleJoin}
            style={{ padding: '10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            입장하기
          </button>
        </div>
      </div>
    );
  }

  // 입장 후 렌더링 화면
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div style={{
        position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', gap: '15px', padding: '10px 20px',
        backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '10px', borderRight: '2px solid #e5e7eb', paddingRight: '15px' }}>
          <button onClick={() => setTool('pen')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: tool === 'pen' ? '#000000' : '#9ca3af' }}>
            <Pen size={24} />
          </button>
          <button onClick={() => setTool('eraser')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: tool === 'eraser' ? '#000000' : '#9ca3af' }}>
            <Eraser size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', borderRight: '2px solid #e5e7eb', paddingRight: '15px' }}>
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => { setCurrentColor(color); setTool('pen'); }}
              style={{
                width: '32px', height: '32px', borderRadius: '50%', backgroundColor: color,
                border: currentColor === color && tool === 'pen' ? '3px solid #94a3b8' : 'none',
                cursor: 'pointer', padding: 0
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleDownload} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6b7280', display: 'flex', alignItems: 'center' }} title="이미지로 저장 (PNG)">
            <Download size={24} />
          </button>
          <button onClick={handleClearAll} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#ef4444', display: 'flex', alignItems: 'center' }} title="전체 지우기">
            <Trash2 size={24} />
          </button>
        </div>
      </div>

      <div style={{
        position: 'absolute', top: '20px', right: '20px', zIndex: 10,
        backgroundColor: 'white', padding: '15px', borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '180px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: '#6b7280', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
          <Users size={20} />
          <span style={{ fontWeight: 'bold' }}>온라인 ({users.length}명)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
          {users.map((userName, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></div>
              <span style={{ fontSize: '14px', color: '#374151' }}>{userName}</span>
            </div>
          ))}
        </div>
      </div>

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
              strokeWidth={line.tool === 'eraser' ? 20 : 5}
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