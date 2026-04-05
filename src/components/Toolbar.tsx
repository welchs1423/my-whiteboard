import React from 'react';
import {
  Eraser, Pen, Trash2, Download, Square, Circle,
  Undo2, Redo2, Type, ArrowRight, Minus, PaintBucket, Grid2X2,
  MousePointer, FileJson, Upload,
  HelpCircle, ImageIcon, StickyNote,
  Magnet, Sun, Moon, Triangle, Spline, Wand2,
} from 'lucide-react';
import type { ToolType, DashStyle } from '../utils/elementHelpers';

const COLORS = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '😮', '👏', '✨'];
const STICKY_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa'];

interface Theme {
  panel: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  shadow: string;
}

export interface ToolbarProps {
  tool: ToolType;
  setTool: React.Dispatch<React.SetStateAction<ToolType>>;
  setSelectedIndices: React.Dispatch<React.SetStateAction<Set<number>>>;
  isViewOnly: boolean;
  theme: Theme;
  isDarkMode: boolean;
  setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  currentColor: string;
  selectColor: (c: string) => void;
  recentColors: string[];
  strokeWidth: number;
  setStrokeWidth: React.Dispatch<React.SetStateAction<number>>;
  isFilled: boolean;
  setIsFilled: React.Dispatch<React.SetStateAction<boolean>>;
  showGrid: boolean;
  setShowGrid: React.Dispatch<React.SetStateAction<boolean>>;
  isSnapEnabled: boolean;
  setIsSnapEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  currentDash: DashStyle;
  setCurrentDash: React.Dispatch<React.SetStateAction<DashStyle>>;
  currentOpacity: number;
  setCurrentOpacity: React.Dispatch<React.SetStateAction<number>>;
  stickyBg: string;
  setStickyBg: React.Dispatch<React.SetStateAction<string>>;
  isSmoothing: boolean;
  setIsSmoothing: React.Dispatch<React.SetStateAction<boolean>>;
  isSmartShape: boolean;
  setIsSmartShape: React.Dispatch<React.SetStateAction<boolean>>;
  isEmojiMode: boolean;
  setIsEmojiMode: React.Dispatch<React.SetStateAction<boolean>>;
  selectedEmoji: string;
  setSelectedEmoji: React.Dispatch<React.SetStateAction<string>>;
  showEmojiPicker: boolean;
  setShowEmojiPicker: React.Dispatch<React.SetStateAction<boolean>>;
  handleUndo: () => void;
  handleRedo: () => void;
  handleDownloadPNG: () => void;
  handleExportJSON: () => void;
  handleClearAll: () => void;
  handleImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImageFile: (file: File, dropPos?: { x: number; y: number }) => void;
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
}

export default function Toolbar({
  tool, setTool, setSelectedIndices,
  isViewOnly, theme, isDarkMode, setIsDarkMode,
  currentColor, selectColor, recentColors,
  strokeWidth, setStrokeWidth,
  isFilled, setIsFilled,
  showGrid, setShowGrid,
  isSnapEnabled, setIsSnapEnabled,
  currentDash, setCurrentDash,
  currentOpacity, setCurrentOpacity,
  stickyBg, setStickyBg,
  isSmoothing, setIsSmoothing,
  isSmartShape, setIsSmartShape,
  isEmojiMode, setIsEmojiMode,
  selectedEmoji, setSelectedEmoji,
  showEmojiPicker, setShowEmojiPicker,
  handleUndo, handleRedo,
  handleDownloadPNG, handleExportJSON, handleClearAll,
  handleImportJSON, handleImageFile,
  setShowHelp,
  importInputRef, imageInputRef,
}: ToolbarProps) {
  const toolBtn = (active: boolean): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer',
    color: active ? '#3b82f6' : theme.textSubtle, display: 'flex', alignItems: 'center', padding: '2px',
  });
  const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: theme.textMuted, display: 'flex', alignItems: 'center', padding: '2px',
  };
  const dashBtn = (active: boolean): React.CSSProperties => ({
    padding: '3px 8px', border: active ? '2px solid #3b82f6' : `1px solid ${theme.border}`,
    borderRadius: '4px', cursor: 'pointer', background: active ? '#eff6ff' : 'none',
    color: active ? '#3b82f6' : theme.textMuted, fontSize: '13px', fontWeight: 'bold', lineHeight: 1,
  });

  return (
    <div style={{ position:'absolute', top:'16px', left:'50%', transform:'translateX(-50%)', zIndex:10, display:'flex', flexDirection:'column', gap:'6px', alignItems:'center' }}>
      {/* 펜 옵션 */}
      {tool === 'pen' && !isViewOnly && (
        <div style={{ display:'flex', gap:'8px', padding:'5px 14px', backgroundColor: theme.panel, borderRadius:'10px', boxShadow: theme.shadow, alignItems:'center' }}>
          <span style={{ fontSize:'11px', color: theme.textMuted }}>펜 옵션</span>
          <button
            onClick={() => setIsSmoothing(v => !v)}
            title="선 매끄럽게 처리 (Smoothing) — 그린 후 자동 보정"
            style={{ display:'flex', alignItems:'center', gap:'4px', padding:'3px 8px', borderRadius:'6px', cursor:'pointer', border: isSmoothing ? '2px solid #3b82f6' : `1px solid ${theme.border}`, background: isSmoothing ? '#eff6ff' : 'none', color: isSmoothing ? '#3b82f6' : theme.textMuted, fontSize:'12px' }}
          >
            <Spline size={15}/> 스무딩
          </button>
          <button
            onClick={() => setIsSmartShape(v => !v)}
            title="도형 자동 인식 (Smart Shape) — 원/삼각형 자동 변환"
            style={{ display:'flex', alignItems:'center', gap:'4px', padding:'3px 8px', borderRadius:'6px', cursor:'pointer', border: isSmartShape ? '2px solid #8b5cf6' : `1px solid ${theme.border}`, background: isSmartShape ? '#f5f3ff' : 'none', color: isSmartShape ? '#8b5cf6' : theme.textMuted, fontSize:'12px' }}
          >
            <Wand2 size={15}/> 스마트 도형
          </button>
        </div>
      )}

      {/* 메인 툴바 */}
      <div style={{ display:'flex', gap:'12px', padding:'8px 16px', backgroundColor: theme.panel, borderRadius:'12px', boxShadow: theme.shadow, alignItems:'center' }}>
        {/* 도구 버튼 */}
        {!isViewOnly && (
          <div style={{ display:'flex', gap:'6px', borderRight:`2px solid ${theme.border}`, paddingRight:'12px' }}>
            <button onClick={() => { setTool('select'); setSelectedIndices(new Set()); }} title="선택 (S)" style={toolBtn(tool==='select')}><MousePointer size={22}/></button>
            <button onClick={() => setTool('pen')} title="펜 (P)" style={toolBtn(tool==='pen')}><Pen size={22}/></button>
            <button onClick={() => setTool('eraser')} title="지우개 (E)" style={toolBtn(tool==='eraser')}><Eraser size={22}/></button>
            <button onClick={() => setTool('rect')} title="사각형 (R)" style={toolBtn(tool==='rect')}><Square size={22}/></button>
            <button onClick={() => setTool('circle')} title="원 (C)" style={toolBtn(tool==='circle')}><Circle size={22}/></button>
            <button onClick={() => setTool('text')} title="텍스트 (T)" style={toolBtn(tool==='text')}><Type size={22}/></button>
            <button onClick={() => setTool('straight')} title="직선 (L)" style={toolBtn(tool==='straight')}><Minus size={22}/></button>
            <button onClick={() => setTool('arrow')} title="화살표 (A)" style={toolBtn(tool==='arrow')}><ArrowRight size={22}/></button>
            <button onClick={() => setTool('sticky')} title="스티커 메모 (N)" style={toolBtn(tool==='sticky')}><StickyNote size={22}/></button>
            <button onClick={() => setTool('triangle')} title="삼각형 (V)" style={toolBtn(tool==='triangle')}><Triangle size={22}/></button>
          </div>
        )}

        {/* 이모지 */}
        {!isViewOnly && (
          <div style={{ position:'relative', borderRight:`2px solid ${theme.border}`, paddingRight:'12px' }}>
            <button
              onClick={() => setShowEmojiPicker(v => !v)}
              title="이모지 반응"
              style={{ ...toolBtn(isEmojiMode), fontSize:'20px', minWidth:'28px', border: isEmojiMode ? '2px solid #3b82f6' : '2px solid transparent', borderRadius:'6px', padding:'2px 4px' }}
            >
              {selectedEmoji}
            </button>
            {showEmojiPicker && (
              <div style={{ position:'absolute', top:'38px', left:0, zIndex:100, backgroundColor: theme.panel, borderRadius:'10px', padding:'8px 10px', display:'flex', gap:'4px', boxShadow: theme.shadow, border:`1px solid ${theme.border}` }}>
                {REACTION_EMOJIS.map(emoji => (
                  <button key={emoji} onClick={() => { setSelectedEmoji(emoji); setIsEmojiMode(true); setShowEmojiPicker(false); }}
                    style={{ fontSize:'22px', background: selectedEmoji === emoji && isEmojiMode ? '#eff6ff' : 'none', border: selectedEmoji === emoji && isEmojiMode ? '2px solid #3b82f6' : '2px solid transparent', borderRadius:'6px', cursor:'pointer', padding:'4px', lineHeight:1 }}>
                    {emoji}
                  </button>
                ))}
                {isEmojiMode && (
                  <button onClick={() => { setIsEmojiMode(false); setShowEmojiPicker(false); }}
                    style={{ fontSize:'12px', background:'#fee2e2', border:'none', borderRadius:'6px', cursor:'pointer', padding:'4px 6px', color:'#ef4444', fontWeight:'bold', alignSelf:'center' }}>
                    OFF
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 채우기 */}
        {!isViewOnly && (
          <div style={{ borderRight:`2px solid ${theme.border}`, paddingRight:'12px' }}>
            <button onClick={() => setIsFilled(v => !v)} title={isFilled ? '채우기 ON' : '채우기 OFF'}
              style={{ background:isFilled?'#3b82f6':'none', border:isFilled?'none':`1px solid ${theme.border}`, borderRadius:'6px', cursor:'pointer', color:isFilled?'white': theme.textSubtle, padding:'2px 6px', display:'flex', alignItems:'center' }}>
              <PaintBucket size={22}/>
            </button>
          </div>
        )}

        {/* 색상 팔레트 */}
        {!isViewOnly && (
          <div style={{ display:'flex', gap:'8px', borderRight:`2px solid ${theme.border}`, paddingRight:'12px', alignItems:'center', flexWrap:'wrap', maxWidth:'260px' }}>
            <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => selectColor(c)}
                  style={{ width:'22px', height:'22px', borderRadius:'50%', backgroundColor:c, border: currentColor===c && tool!=='eraser' ? '3px solid #3b82f6' : `1px solid ${theme.border}`, cursor:'pointer' }} />
              ))}
              <label title="커스텀 색상" style={{ position:'relative', width:'22px', height:'22px', cursor:'pointer' }}>
                <input type="color" value={currentColor} onChange={(e) => selectColor(e.target.value)}
                  style={{ position:'absolute', opacity:0, width:'100%', height:'100%', cursor:'pointer', top:0, left:0 }} />
                <div style={{ width:'22px', height:'22px', borderRadius:'50%', background:'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)', border: !COLORS.includes(currentColor)&&tool!=='eraser' ? '3px solid #3b82f6' : `1px solid ${theme.border}` }} />
              </label>
            </div>
            {recentColors.length > 0 && (
              <div style={{ display:'flex', gap:'4px', alignItems:'center', borderLeft:`1px solid ${theme.border}`, paddingLeft:'6px' }}>
                <span style={{ fontSize:'10px', color:theme.textSubtle, whiteSpace:'nowrap' }}>최근</span>
                {recentColors.map((c, i) => (
                  <button key={i} onClick={() => selectColor(c)} title={c}
                    style={{ width:'18px', height:'18px', borderRadius:'50%', backgroundColor:c, border: currentColor===c ? '2px solid #3b82f6' : `1px solid ${theme.border}`, cursor:'pointer' }} />
                ))}
              </div>
            )}
            {tool === 'sticky' && (
              <div style={{ display:'flex', gap:'4px', alignItems:'center', borderLeft:`1px solid ${theme.border}`, paddingLeft:'8px' }}>
                {STICKY_COLORS.map(c => (
                  <button key={c} onClick={() => setStickyBg(c)}
                    style={{ width:'20px', height:'20px', borderRadius:'4px', backgroundColor:c, border: stickyBg===c ? '2px solid #3b82f6' : '1px solid #d1d5db', cursor:'pointer' }} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 선 굵기 */}
        {!isViewOnly && (
          <div style={{ display:'flex', alignItems:'center', gap:'8px', borderRight:`2px solid ${theme.border}`, paddingRight:'12px' }}>
            <span style={{ fontSize:'11px', color:theme.textMuted, whiteSpace:'nowrap' }}>{tool==='text' ? '크기' : '굵기'}</span>
            <input type="range" min="1" max="50" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} style={{ width:'70px' }} />
            <span style={{ fontSize:'11px', color:theme.textSubtle, minWidth:'20px' }}>{tool==='text' ? Math.max(12,strokeWidth*3) : strokeWidth}</span>
          </div>
        )}

        {/* 선 스타일 */}
        {!isViewOnly && (
          <div style={{ display:'flex', gap:'4px', alignItems:'center', borderRight:`2px solid ${theme.border}`, paddingRight:'12px' }}>
            <button style={dashBtn(currentDash==='solid')} onClick={() => setCurrentDash('solid')} title="실선">—</button>
            <button style={dashBtn(currentDash==='dashed')} onClick={() => setCurrentDash('dashed')} title="파선">- -</button>
            <button style={dashBtn(currentDash==='dotted')} onClick={() => setCurrentDash('dotted')} title="점선">···</button>
          </div>
        )}

        {/* 투명도 */}
        {!isViewOnly && (
          <div style={{ display:'flex', alignItems:'center', gap:'6px', borderRight:`2px solid ${theme.border}`, paddingRight:'12px' }}>
            <span style={{ fontSize:'11px', color:theme.textMuted }}>투명도</span>
            <input type="range" min="10" max="100" value={Math.round(currentOpacity*100)} onChange={(e) => setCurrentOpacity(Number(e.target.value)/100)} style={{ width:'60px' }} />
            <span style={{ fontSize:'11px', color:theme.textSubtle, minWidth:'28px' }}>{Math.round(currentOpacity*100)}%</span>
          </div>
        )}

        {/* 우측 버튼 */}
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          {isViewOnly ? (
            <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'4px 10px', backgroundColor:'#fef3c7', border:'1px solid #f59e0b', borderRadius:'8px', color:'#92400e', fontSize:'12px', fontWeight:'bold' }}>
              👁️ 읽기 전용
            </div>
          ) : (
            <>
              <button onClick={handleUndo} title="실행 취소 (Ctrl+Z)" style={iconBtn}><Undo2 size={22}/></button>
              <button onClick={handleRedo} title="다시 실행 (Ctrl+Y)" style={iconBtn}><Redo2 size={22}/></button>
              <button onClick={() => setShowGrid(v => !v)} title="그리드 토글" style={{ ...iconBtn, color: showGrid?'#3b82f6':'#9ca3af' }}><Grid2X2 size={22}/></button>
              <button onClick={() => setIsSnapEnabled(v => !v)} title="그리드 스냅 ON/OFF" style={{ ...iconBtn, color: isSnapEnabled?'#3b82f6':'#9ca3af' }}><Magnet size={22}/></button>
              <button onClick={handleDownloadPNG} title="PNG 저장" style={iconBtn}><Download size={22}/></button>
              <button onClick={handleExportJSON} title="JSON 내보내기" style={iconBtn}><FileJson size={22}/></button>
              <button onClick={() => importInputRef.current?.click()} title="JSON 가져오기" style={iconBtn}><Upload size={22}/></button>
              <button onClick={() => imageInputRef.current?.click()} title="이미지 삽입" style={iconBtn}><ImageIcon size={22}/></button>
              <button onClick={handleClearAll} title="전체 지우기" style={{ ...iconBtn, color:'#ef4444' }}><Trash2 size={22}/></button>
            </>
          )}
          <button onClick={() => setShowHelp(v => !v)} title="단축키 도움말 (?)" style={iconBtn}><HelpCircle size={22}/></button>
          <button onClick={() => setIsDarkMode(v => !v)} title={isDarkMode ? '라이트 모드' : '다크 모드'} style={{ ...iconBtn, color: isDarkMode ? '#f59e0b' : '#6b7280' }}>
            {isDarkMode ? <Sun size={22}/> : <Moon size={22}/>}
          </button>
        </div>

        <input ref={importInputRef} type="file" accept=".json" onChange={handleImportJSON} style={{ display:'none' }} />
        <input ref={imageInputRef} type="file" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); e.target.value=''; }} style={{ display:'none' }} />
      </div>
    </div>
  );
}
