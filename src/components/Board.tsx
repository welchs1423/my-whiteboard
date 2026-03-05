import { useState, useRef } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import Konva from 'konva';

// 선의 데이터 타입을 정의
interface LineData {
    points: number[];
    color: string;
}

export default function Board() {
  // 캔버스에 그려진 모든 선들의 데이터를 담는 상태 (State)
  const [lines, setLines] = useState<LineData[]>([]);
  // 현재 마우스를 누른 상태로 그림을 그리고 있는지 여부 (화면 렌더링과 무관하므로 useRef 사용)
  const isDrawing = useRef(false);

  // 1. 마우스를 클릭했을 때 (그리기 시작)
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    isDrawing.current = true;
    const pos = e.target.getStage()?.getPointerPosition(); // 현재 마우스 좌표 가져오기
    // 새로운 선을 배열에 추가 (시작점 좌표)
    if (!pos) return;
    setLines([...lines, { points: [pos.x, pos.y], color: '#000000' }]); 
  };

  // 2. 마우스를 누른 채로 움직일 때 (선 그리기)
  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing.current) return; // 그리는 중이 아니면 무시

    const stage = e.target.getStage();
    const point = stage?.getPointerPosition();   // 움직인 마우스 좌표

    if (!point) return;
    const lastLine = { ...lines[lines.length - 1] };
    lastLine.points = lastLine.points.concat([point.x, point.y]);

    const newLines = [...lines];
    newLines.splice(lines.length - 1, 1, lastLine);

    setLines(newLines);
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  return (
    // Stage : 가장 밑바탕이 되는 전체 캔버스 영역
    <Stage
     width={window.innerWidth}
     height={window.innerHeight}
     onMouseDown={handleMouseDown}
     onMouseMove={handleMouseMove}
     onMouseUp={handleMouseUp}
     >
        {/* Layer: Stage 위에 올라가는 투명한 필름 같은 역할 */}
        <Layer>
            {lines.map((line,i) => (
                <Line
                key={i}
                points={line.points}
                stroke={line.color}
                strokeWidth={5} // 선 굵기
                tension={0.5}   // 선을 부드럽게 깎아주는 정도
                lineCap="round" // 선의 끝을 둥글게
                lineJoin="round"    // 선이 꺾이는 부분을 둥글게
            />
            ))}
        </Layer>
     </Stage>
  );
}