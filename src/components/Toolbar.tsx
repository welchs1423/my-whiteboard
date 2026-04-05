import React from 'react';
import {
  Eraser, Pen, Trash2, Download, Square, Circle,
  Undo2, Redo2, Type, ArrowRight, Minus, PaintBucket, Grid2X2,
  MousePointer, FileJson, Upload,
  HelpCircle, ImageIcon, StickyNote,
  Magnet, Sun, Moon, Triangle, Spline, Wand2, Layout,
  Waypoints, Workflow, MapPin, AlignLeft, AlignCenter, AlignRight,
  Presentation, Crosshair, QrCode, FileImage, Shapes, Bold, Italic, Underline,
} from 'lucide-react';
import type { ToolType, DashStyle, LineCapStyle } from '../utils/elementHelpers';

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
  currentLineCap: LineCapStyle;
  setCurrentLineCap: React.Dispatch<React.SetStateAction<LineCapStyle>>;
  showLayerPanel: boolean;
  setShowLayerPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showFramePanel: boolean;
  setShowFramePanel: React.Dispatch<React.SetStateAction<boolean>>;
  showTimeline: boolean;
  setShowTimeline: React.Dispatch<React.SetStateAction<boolean>>;
  // 신규 props
  currentShapeName: string;
  showShapeLibrary: boolean;
  setShowShapeLibrary: React.Dispatch<React.SetStateAction<boolean>>;
  gradientColors: [string, string] | null;
  setGradientColors: React.Dispatch<React.SetStateAction<[string, string] | null>>;
  gradientAngle: number;
  setGradientAngle: React.Dispatch<React.SetStateAction<number>>;
  fontStyle: string;
  setFontStyle: React.Dispatch<React.SetStateAction<string>>;
  textDecoration: string;
  setTextDecoration: React.Dispatch<React.SetStateAction<string>>;
  fontFamily: string;
  setFontFamily: React.Dispatch<React.SetStateAction<string>>;
  textAlign: string;
  setTextAlign: React.Dispatch<React.SetStateAction<string>>;
  isLaserMode: boolean;
  setIsLaserMode: React.Dispatch<React.SetStateAction<boolean>>;
  isPresentingMode: boolean;
  setIsPresentingMode: React.Dispatch<React.SetStateAction<boolean>>;
  bgImageInputRef: React.RefObject<HTMLInputElement | null>;
  handleExportSVG: () => void;
  handleShowQRCode: () => void;
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
  currentLineCap, setCurrentLineCap,
  showLayerPanel, setShowLayerPanel,
  showFramePanel, setShowFramePanel,
  showTimeline, setShowTimeline,
  currentShapeName, showShapeLibrary, setShowShapeLibrary,
  gradientColors, setGradientColors, gradientAngle, setGradientAngle,
  fontStyle, setFontStyle, textDecoration, setTextDecoration,
  fontFamily, setFontFamily, textAlign, setTextAlign,
  isLaserMode, setIsLaserMode, isPresentingMode, setIsPresentingMode,
  bgImageInputRef, handleExportSVG, handleShowQRCode,
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
  const capBtn = (active: boolean): React.CSSProperties => ({
    padding: '3px 8px', border: active ? '2px solid #8b5cf6' : `1px solid ${theme.border}`,
    borderRadius: '4px', cursor: 'pointer', background: active ? '#f5f3ff' : 'none',
    color: active ? '#8b5cf6' : theme.textMuted, fontSize: '11px', fontWeight: 'bold', lineHeight: 1,
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

      {/* 리치 텍스트 서브툴바 */}
      {(tool === 'text' || tool === 'textbox') && !isViewOnly && (
        <div style={{ display:'flex', gap:'6px', padding:'5px 14px', backgroundColor: theme.panel, borderRadius:'10px', boxShadow: theme.shadow, alignItems:'center' }}>
          <button title="굵게" onClick={() => setFontStyle(v => v.includes('bold') ? v.replace('bold', '').trim() || 'normal' : (v === 'normal' || !v ? 'bold' : v + ' bold'))}
            style={{ padding:'2px 7px', borderRadius:'5px', border: fontStyle.includes('bold') ? '2px solid #3b82f6' : `1px solid ${theme.border}`, cursor:'pointer', background: fontStyle.includes('bold') ? '#eff6ff' : 'none', color: fontStyle.includes('bold') ? '#3b82f6' : theme.textMuted }}>
            <Bold size={15}/>
          </button>
          <button title="기울임" onClick={() => setFontStyle(v => v.includes('italic') ? v.replace('italic', '').trim() || 'normal' : (v === 'normal' || !v ? 'italic' : v + ' italic'))}
            style={{ padding:'2px 7px', borderRadius:'5px', border: fontStyle.includes('italic') ? '2px solid #3b82f6' : `1px solid ${theme.border}`, cursor:'pointer', background: fontStyle.includes('italic') ? '#eff6ff' : 'none', color: fontStyle.includes('italic') ? '#3b82f6' : theme.textMuted }}>
            <Italic size={15}/>
          </button>
          <button title="밑줄" onClick={() => setTextDecoration(v => v === 'underline' ? '' : 'underline')}
            style={{ padding:'2px 7px', borderRadius:'5px', border: textDecoration === 'underline' ? '2px solid #3b82f6' : `1px solid ${theme.border}`, cursor:'pointer', background: textDecoration === 'underline' ? '#eff6ff' : 'none', color: textDecoration === 'underline' ? '#3b82f6' : theme.textMuted }}>
            <Underline size={15}/>
          </button>
          <span style={{ width:'1px', height:'16px', backgroundColor: theme.border }} />
          <button title="왼쪽 정렬" onClick={() => setTextAlign('left')} style={{ padding:'2px 6px', borderRadius:'5px', border: textAlign === 'left' ? '2px solid #3b82f6' : `1px solid ${theme.border}`, cursor:'pointer', background: textAlign === 'left' ? '#eff6ff' : 'none' }}><AlignLeft size={14}/></button>
          <button title="가운데 정렬" onClick={() => setTextAlign('center')} style={{ padding:'2px 6px', borderRadius:'5px', border: textAlign === 'center' ? '2px solid #3b82f6' : `1px solid ${theme.border}`, cursor:'pointer', background: textAlign === 'center' ? '#eff6ff' : 'none' }}><AlignCenter size={14}/></button>
          <button title="오른쪽 정렬" onClick={() => setTextAlign('right')} style={{ padding:'2px 6px', borderRadius:'5px', border: textAlign === 'right' ? '2px solid #3b82f6' : `1px solid ${theme.border}`, cursor:'pointer', background: textAlign === 'right' ? '#eff6ff' : 'none' }}><AlignRight size={14}/></button>
          <span style={{ width:'1px', height:'16px', backgroundColor: theme.border }} />
          <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} style={{ border:`1px solid ${theme.border}`, borderRadius:'5px', padding:'2px 4px', fontSize:'12px', background: theme.panel, color: theme.text }}>
            <option value="sans-serif">Sans</option>
            <option value="serif">Serif</option>
            <option value="monospace">Mono</option>
            <option value="cursive">Cursive</option>
          </select>
        </div>
      )}

      {/* 그라디언트 서브툴바 */}
      {isFilled && ['rect','circle','triangle','shape','textbox'].includes(tool) && !isViewOnly && (
        <div style={{ display:'flex', gap:'6px', padding:'5px 14px', backgroundColor: theme.panel, borderRadius:'10px', boxShadow: theme.shadow, alignItems:'center' }}>
          <span style={{ fontSize:'11px', color: theme.textMuted }}>그라디언트</span>
          <button onClick={() => setGradientColors(gradientColors ? null : [currentColor, '#ffffff'])}
            style={{ padding:'3px 10px', borderRadius:'6px', border: gradientColors ? '2px solid #8b5cf6' : `1px solid ${theme.border}`, cursor:'pointer', background: gradientColors ? '#f5f3ff' : 'none', color: gradientColors ? '#8b5cf6' : theme.textMuted, fontSize:'12px' }}>
            {gradientColors ? 'ON' : 'OFF'}
          </button>
          {gradientColors && (
            <>
              <input type="color" value={gradientColors[0]} onChange={e => setGradientColors([e.target.value, gradientColors[1]])} title="시작 색상" style={{ width:'28px', height:'24px', border:'none', cursor:'pointer', borderRadius:'4px' }}/>
              <input type="color" value={gradientColors[1]} onChange={e => setGradientColors([gradientColors[0], e.target.value])} title="끝 색상" style={{ width:'28px', height:'24px', border:'none', cursor:'pointer', borderRadius:'4px' }}/>
              <select value={gradientAngle} onChange={e => setGradientAngle(Number(e.target.value))} style={{ border:`1px solid ${theme.border}`, borderRadius:'5px', padding:'2px 4px', fontSize:'12px', background: theme.panel, color: theme.text }} title="각도">
                <option value={0}>→ 0°</option>
                <option value={90}>↓ 90°</option>
                <option value={45}>↘ 45°</option>
                <option value={135}>↙ 135°</option>
                <option value={180}>← 180°</option>
              </select>
            </>
          )}
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
            <button onClick={() => setTool('frame')} title="프레임 (F2)" style={toolBtn(tool==='frame')}><Layout size={22}/></button>
            {/* 신규 도구 */}
            <button onClick={() => setTool('bezier')} title="베지어 곡선 — 3클릭으로 곡선 그리기" style={toolBtn(tool==='bezier')}><Waypoints size={22}/></button>
            <button onClick={() => setTool('connector')} title="연결선 — 두 요소를 연결하는 선" style={toolBtn(tool==='connector')}><Workflow size={22}/></button>
            <button onClick={() => setTool('pin')} title="댓글 핀 — 클릭 위치에 핀 고정" style={toolBtn(tool==='pin')}><MapPin size={22}/></button>
            <button onClick={() => setTool('textbox')} title="텍스트박스 — 드래그하여 텍스트 영역 생성" style={toolBtn(tool==='textbox')}><span style={{ fontSize:'14px', fontWeight:'bold', lineHeight:1 }}>A□</span></button>
            <button onClick={() => setShowShapeLibrary(v => !v)} title={`도형 라이브러리 — 현재: ${currentShapeName}`} style={{ ...toolBtn(tool==='shape' || showShapeLibrary), position:'relative' }}>
              <Shapes size={22}/>
            </button>
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

        {/* 선 끝 스타일 (pen/straight/arrow) */}
        {!isViewOnly && ['pen','eraser','straight','arrow'].includes(tool) && (
          <div style={{ display:'flex', gap:'4px', alignItems:'center', borderRight:`2px solid ${theme.border}`, paddingRight:'12px' }}>
            <span style={{ fontSize:'10px', color:theme.textMuted, whiteSpace:'nowrap' }}>끝</span>
            <button style={capBtn(currentLineCap==='round')} onClick={() => setCurrentLineCap('round')} title="둥근 끝점">○</button>
            <button style={capBtn(currentLineCap==='square')} onClick={() => setCurrentLineCap('square')} title="사각 끝점">□</button>
            <button style={capBtn(currentLineCap==='butt')} onClick={() => setCurrentLineCap('butt')} title="평단 끝점">|—|</button>
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
              <button onClick={handleExportSVG} title="SVG 내보내기" style={iconBtn}><FileImage size={22}/></button>
              <button onClick={handleExportJSON} title="JSON 내보내기" style={iconBtn}><FileJson size={22}/></button>
              <button onClick={() => importInputRef.current?.click()} title="JSON 가져오기" style={iconBtn}><Upload size={22}/></button>
              <button onClick={() => imageInputRef.current?.click()} title="이미지 삽입" style={iconBtn}><ImageIcon size={22}/></button>
              <button onClick={() => bgImageInputRef.current?.click()} title="캔버스 배경 이미지" style={iconBtn}><span style={{ fontSize:'12px', fontWeight:'bold' }}>BG</span></button>
              <span style={{ width:'1px', height:'20px', backgroundColor: theme.border }} />
              <button onClick={() => setIsLaserMode(v => !v)} title="레이저 포인터 ON/OFF" style={{ ...iconBtn, color: isLaserMode ? '#ef4444' : '#9ca3af' }}><Crosshair size={22}/></button>
              <button onClick={() => setIsPresentingMode(true)} title="발표 모드 (풀스크린)" style={{ ...iconBtn, color: isPresentingMode ? '#6366f1' : '#9ca3af' }}><Presentation size={22}/></button>
              <button onClick={handleShowQRCode} title="QR 코드 방 공유" style={iconBtn}><QrCode size={22}/></button>
              <span style={{ width:'1px', height:'20px', backgroundColor: theme.border }} />
              <button onClick={() => setShowLayerPanel(v => !v)} title="레이어 패널" style={{ ...iconBtn, color: showLayerPanel?'#6366f1':'#9ca3af' }}>&#9638;</button>
              <button onClick={() => setShowFramePanel(v => !v)} title="프레임 패널" style={{ ...iconBtn, color: showFramePanel?'#6366f1':'#9ca3af' }}><Layout size={22}/></button>
              <button onClick={() => setShowTimeline(v => !v)} title="타임라인" style={{ ...iconBtn, color: showTimeline?'#6366f1':'#9ca3af' }}>&#9654;</button>
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
