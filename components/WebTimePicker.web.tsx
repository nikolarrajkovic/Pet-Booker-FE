import React, { useState } from 'react';

export interface WebTimePickerProps {
  value: Date;
  isDarkMode: boolean;
  onChange: (time: Date) => void;
  onClose: () => void;
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";

export default function WebTimePicker({ value, isDarkMode, onChange, onClose }: WebTimePickerProps) {
  const [h, setH] = useState(value.getHours());
  const [m, setM] = useState(value.getMinutes());

  const bg     = isDarkMode ? '#1a2332' : '#ffffff';
  const text   = isDarkMode ? '#ffffff' : '#111827';
  const border = isDarkMode ? '#374151' : '#E5E7EB';

  const apply = (hours: number, mins: number) => {
    const t = new Date(value);
    t.setHours(hours, mins, 0, 0);
    onChange(t);
  };

  const arrowBtn = (label: string, onClick: () => void) => (
    // @ts-ignore
    <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00C870', fontSize: 20, fontWeight: 700, padding: '4px 14px', fontFamily: FONT, lineHeight: 1 }}>
      {label}
    </button>
  );

  const valStyle: React.CSSProperties = { color: text, fontSize: 38, fontWeight: 700, fontFamily: FONT, minWidth: 60, textAlign: 'center' };

  return (
    // @ts-ignore
    <div style={{ background: bg, borderRadius: 14, padding: 20, marginTop: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.22)', border: `1px solid ${border}`, fontFamily: FONT }}>

      {/* Time display */}
      {/* @ts-ignore */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>

        {/* Hours */}
        {/* @ts-ignore */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {arrowBtn('▲', () => { const n = (h + 1) % 24; setH(n); apply(n, m); })}
          {/* @ts-ignore */}
          <span style={valStyle}>{(h % 12 || 12).toString().padStart(2, '0')}</span>
          {arrowBtn('▼', () => { const n = (h - 1 + 24) % 24; setH(n); apply(n, m); })}
        </div>

        {/* @ts-ignore */}
        <span style={{ color: text, fontSize: 38, fontWeight: 700, padding: '0 2px', userSelect: 'none' }}>:</span>

        {/* Minutes */}
        {/* @ts-ignore */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {arrowBtn('▲', () => { const n = (m + 5) % 60; setM(n); apply(h, n); })}
          {/* @ts-ignore */}
          <span style={valStyle}>{m.toString().padStart(2, '0')}</span>
          {arrowBtn('▼', () => { const n = (m - 5 + 60) % 60; setM(n); apply(h, n); })}
        </div>

        {/* AM / PM toggle */}
        {/* @ts-ignore */}
        <button
          onClick={() => { const n = h >= 12 ? h - 12 : h + 12; setH(n); apply(n, m); }}
          style={{ background: '#00C870', border: 'none', cursor: 'pointer', color: '#fff', fontFamily: FONT, fontSize: 15, fontWeight: 700, borderRadius: 8, padding: '10px 12px', marginLeft: 10 }}
        >
          {h >= 12 ? 'PM' : 'AM'}
        </button>
      </div>

      {/* Footer */}
      {/* @ts-ignore */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, paddingTop: 12, borderTop: `1px solid ${border}` }}>
        {/* @ts-ignore */}
        <button onClick={onClose} style={{ background: '#00C870', border: 'none', cursor: 'pointer', color: '#fff', fontFamily: FONT, fontSize: 13, fontWeight: 700, borderRadius: 8, padding: '8px 24px' }}>Done</button>
      </div>
    </div>
  );
}
