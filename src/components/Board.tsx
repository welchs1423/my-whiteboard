import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import Konva from 'konva';
import { Eraser, Pen, Trash2 } from 'lucide-react'; // 👈 Trash2 아이콘 추가
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
  const isDrawing = useRef(false);

  useEffect(() => {
    // 다른 사람이 선을 그렸을 때
    socket.on('draw_line', (incomingLines: LineData[]) => {
      setLines(incomingLines);
    });

    // 👈 다른 사람이 '전체 지우기'를 눌렀을 때 내 화면도 비움
    socket.on('clear_all', () => {
      setLines([]);
    });

    return () => {
      socket.off('draw_line');
      socket.off('clear_all'); // 👈 리스너 정리 추가
    };
  }, []);

  // 👈 내가 '전체 지우기' 버튼을 눌렀을 때 실행되는 함수
  const handleClearAll = () => {
    setLines([]); // 1. 내 화면을 비운다
    socket.emit('clear_all'); // 2. 서버에 "다른 애들 화면도 다 지워!"라고 알린다
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

        {/* 👈 전체 지우기 버튼 추가 */}
        <button 
          onClick={handleClearAll} 
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#ef4444', display: 'flex', alignItems: 'center' }}
          title="전체 지우기"
        >
          <Trash2 size={24} />
        </button>

      </div>

      <Stage
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