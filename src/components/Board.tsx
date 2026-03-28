// src/components/Board.tsx
import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import Konva from 'konva';
import { Eraser, Pen, Trash2, Download, Users } from 'lucide-react'; // 👈 Users 아이콘 추가
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

interface LineData {
  tool: string;
  points: number[];
  color: string;
}

const COLORS = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];

export default function Board() {
  const [lines, setLines] = useState<LineData[]>([]);
  const [currentColor, setCurrentColor] = useState<string>(COLORS[0]);
  const [tool, setTool] = useState<string>('pen');
  const [users, setUsers] = useState<string[]>([]); // 👈 1. 접속 유저 목록 상태 추가
  
  const isDrawing = useRef(false);
  const stageRef = useRef<Konva.Stage>(null); 

  useEffect(() => {
    socket.on('draw_line', (incomingLines: LineData[]) => {
      setLines(incomingLines);
    });

    socket.on('clear_all', () => {
      setLines([]);
    });

    // 👈 2. 서버에서 최신 유저 목록을 보내주면 상태 업데이트
    socket.on('user_list', (incomingUsers: string[]) => {
      setUsers(incomingUsers);
    });

    return () => {
      socket.off('draw_line');
      socket.off('clear_all');
      socket.off('user_list'); // 👈 리스너 정리 추가
    };
  }, []);

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

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      
      {/* 중앙 상단 도구 모음 (기존 코드와 거의 동일, gap만 살짝 조정) */}
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

      {/* 👈 3. 우측 상단 접속자 목록 UI 추가 */}
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