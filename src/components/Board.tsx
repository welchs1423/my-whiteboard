// src/components/Board.tsx 상단 import에 MessageSquare 아이콘 추가
import { Eraser, Pen, Trash2, Download, Users, MessageSquare, Send } from 'lucide-react';

// ... (기존 인터페이스 및 COLORS 동일)

interface ChatMessage {
  text: string;
  sender: string;
  time: string;
}

export default function Board() {
  // ... (기존 상태들 동일)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ... (기존 socket.on 로직들 동일)

    socket.on('receive_message', (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      // ... (기존 off 로직들)
      socket.off('receive_message');
    };
  }, []);

  // 새 메시지가 올 때마다 채팅창 스크롤을 아래로 내림
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  // ... (기존 핸들러 함수들 동일: handleJoin, handleClearAll 등)

  if (!isJoined) { /* ... 기존 입장 화면 동일 ... */ }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* ... 상단 도구 모음 및 접속자 목록 UI 동일 ... */}

      {/* 💬 실시간 채팅 UI 추가 */}
      <div style={{
        position: 'absolute', bottom: '20px', right: '20px', zIndex: 10,
        width: '300px', height: '400px', backgroundColor: 'white',
        borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* 채팅 헤더 */}
        <div style={{ padding: '15px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontWeight: 'bold' }}>
          <MessageSquare size={20} /> 실시간 채팅
        </div>

        {/* 메시지 리스트 */}
        <div style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ alignSelf: msg.sender === nickname ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px', textAlign: msg.sender === nickname ? 'right' : 'left' }}>
                {msg.sender} • {msg.time}
              </div>
              <div style={{
                padding: '8px 12px', borderRadius: '12px', fontSize: '14px',
                backgroundColor: msg.sender === nickname ? '#3b82f6' : '#f3f4f6',
                color: msg.sender === nickname ? 'white' : '#374151'
              }}>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* 입력창 */}
        <div style={{ padding: '10px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="메시지 입력..."
            style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', fontSize: '14px' }}
          />
          <button onClick={handleSendMessage} style={{ padding: '8px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            <Send size={18} />
          </button>
        </div>
      </div>

      <Stage ref={stageRef} /* ... 이하 Stage 설정 동일 ... */>
        <Layer>
          {lines.map((line, i) => (
            <Line key={i} {...line} strokeWidth={line.strokeWidth || 5} tension={0.5} lineCap="round" lineJoin="round" globalCompositeOperation={line.tool === 'eraser' ? 'destination-out' : 'source-over'} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}