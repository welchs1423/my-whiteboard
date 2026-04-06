import { X } from 'lucide-react';
import { TEMPLATES } from '../data/templates';
import type { DrawElement } from '../utils/elementHelpers';

interface Theme {
  panel: string; border: string; text: string; textMuted: string;
  textSubtle: string; shadow: string;
}

interface TemplateGalleryProps {
  theme: Theme;
  onLoad: (elements: DrawElement[]) => void;
  onClose: () => void;
}

export default function TemplateGallery({ theme, onLoad, onClose }: TemplateGalleryProps) {
  const handleLoad = (elements: DrawElement[]) => {
    if (window.confirm('현재 캔버스를 초기화하고 템플릿을 불러올까요?')) {
      onLoad(elements);
      onClose();
    }
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, backgroundColor:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ backgroundColor: theme.panel, borderRadius:'16px', padding:'28px', width:'640px', maxHeight:'80vh', overflowY:'auto', boxShadow: theme.shadow }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <h2 style={{ margin:0, fontSize:'20px', color: theme.text }}>📐 템플릿 갤러리</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color: theme.textMuted }}>
            <X size={20}/>
          </button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'16px' }}>
          {TEMPLATES.map(tmpl => (
            <div key={tmpl.id}
              onClick={() => handleLoad(tmpl.elements)}
              style={{ padding:'20px', border:`2px solid ${theme.border}`, borderRadius:'12px', cursor:'pointer', transition:'border-color 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#3b82f6'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(59,130,246,0.15)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = theme.border; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}>
              <div style={{ fontSize:'40px', marginBottom:'10px' }}>{tmpl.thumbnail}</div>
              <div style={{ fontSize:'16px', fontWeight:'bold', color: theme.text, marginBottom:'6px' }}>{tmpl.name}</div>
              <div style={{ fontSize:'13px', color: theme.textMuted }}>{tmpl.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
