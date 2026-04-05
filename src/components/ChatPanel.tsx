import { Send, MessageSquare, ChevronDown } from 'lucide-react';

interface Theme {
  panel: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  shadow: string;
  inputBg: string;
  inputBorder: string;
  chatBubbleSelf: string;
  chatBubbleOther: string;
  chatTextOther: string;
}

interface ChatMessage { text: string; sender: string; time: string; }

export interface ChatPanelProps {
  theme: Theme;
  isChatOpen: boolean;
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  messages: ChatMessage[];
  nickname: string;
  typingUsers: string[];
  inputText: string;
  handleSendMessage: () => void;
  handleInputChange: (value: string) => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function ChatPanel({
  theme, isChatOpen, setIsChatOpen,
  messages, nickname, typingUsers,
  inputText, handleSendMessage, handleInputChange,
  chatEndRef,
}: ChatPanelProps) {
  return (
    <div style={{ position:'absolute', bottom:'20px', right:'20px', zIndex:10, width:'280px', backgroundColor: theme.panel, borderRadius:'12px', boxShadow: theme.shadow, display:'flex', flexDirection:'column' }}>
      <div
        style={{ padding:'12px', borderBottom:isChatOpen?`1px solid ${theme.border}`:'none', fontWeight:'bold', display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', color: theme.text }}
        onClick={() => setIsChatOpen(v => !v)}
      >
        <MessageSquare size={18}/>
        <span style={{ flex:1 }}>
          채팅 {messages.length > 0 && !isChatOpen && (
            <span style={{ fontSize:'11px', backgroundColor:'#3b82f6', color:'white', borderRadius:'10px', padding:'1px 6px' }}>{messages.length}</span>
          )}
        </span>
        <ChevronDown size={16} style={{ color: theme.textSubtle, transform:isChatOpen?'rotate(0deg)':'rotate(-90deg)', transition:'transform 0.2s' }}/>
      </div>
      {isChatOpen && (
        <>
          <div style={{ height:'240px', padding:'10px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'8px' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ alignSelf:msg.sender===nickname?'flex-end':'flex-start', maxWidth:'85%' }}>
                <div style={{ fontSize:'10px', color: theme.textSubtle, textAlign:msg.sender===nickname?'right':'left' }}>{msg.sender}</div>
                <div style={{ padding:'6px 10px', borderRadius:'10px', fontSize:'13px', backgroundColor:msg.sender===nickname ? theme.chatBubbleSelf : theme.chatBubbleOther, color:msg.sender===nickname?'white': theme.chatTextOther }}>{msg.text}</div>
              </div>
            ))}
            <div ref={chatEndRef}/>
          </div>
          {typingUsers.length > 0 && (
            <div style={{ padding:'4px 12px', fontSize:'11px', color: theme.textSubtle, fontStyle:'italic' }}>
              {typingUsers.join(', ')}이(가) 입력 중...
            </div>
          )}
          <div style={{ padding:'10px', borderTop:`1px solid ${theme.border}`, display:'flex', gap:'5px' }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="메시지..."
              style={{ flex:1, padding:'6px', borderRadius:'4px', border:`1px solid ${theme.inputBorder}`, fontSize:'13px', backgroundColor: theme.inputBg, color: theme.text }}
            />
            <button onClick={handleSendMessage} style={{ padding:'6px', backgroundColor:'#3b82f6', color:'white', border:'none', borderRadius:'4px', cursor:'pointer' }}>
              <Send size={16}/>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
