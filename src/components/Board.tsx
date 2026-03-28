import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import Konva from 'konva';
import { Eraser, Pen, Trash2, Download } from 'lucide-react'; // 👈 Download 아이콘 추가
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
  
  // 👈 1. Stage 컴포넌트에 직접 접근하기 위한 ref 추가
  const stageRef = useRef<Konva.Stage>(null); 

  useEffect(() => {
    socket.on('draw_line', (incomingLines: LineData[]) => {
      setLines(incomingLines);
    });

    socket.on('clear_all', () => {
      setLines([]);
    });

    return () => {
      socket.off('draw_line');
      socket.off('clear_all');
    };
  }, []);

  const handleClearAll = () => {
    setLines([]);
    socket.emit('clear_all');
  };

  // 👈 2. 현재 캔버스를 PNG 이미지로 다운로드하는 함수
  const handleDownload = () => {
    if (!stageRef.current) return;

    // Stage의 현재 모습을 이미지 데이터 URL(base64)로 변환
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 }); // pixelRatio: 2로 설정하면 고화질로 저장됨
    
    // 가상의 <a> 태그를 만들어 다운로드 트리거
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`; // 파일명 설정 (예: whiteboard-123456789.png)
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click(); // 프로그램적으로 클릭 이벤트 발생
    document.body.removeChild(link); // 사용 후 태그 제거
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

        {/* 도구 모음 우측에 버튼들 배치 */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {/* 👈 이미지 다운로드 버튼 추가 */}
          <button 
            onClick={handleDownload} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6b7280', display: 'flex', alignItems: 'center' }}
            title="이미지로 저장 (PNG)"
          >
            <Download size={24} />
          </button>
          
          <button 
            onClick={handleClearAll} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#ef4444', display: 'flex', alignItems: 'center' }}
            title="전체 지우기"
          >
            <Trash2 size={24} />
          </button>
        </div>

      </div>

      <Stage
        ref={stageRef} // 👈 3. Stage 컴포넌트에 ref 연결
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