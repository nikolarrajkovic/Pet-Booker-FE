import React, { useState } from 'react';

export interface WebDatePickerProps {
  value: Date;
  minDate?: Date;
  isDarkMode: boolean;
  onChange: (date: Date | null) => void;
  onClose: () => void;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";

export default function WebDatePicker({ value, minDate, isDarkMode, onChange, onClose }: WebDatePickerProps) {
  const [view, setView] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));

  const bg     = isDarkMode ? '#1a2332' : '#ffffff';
  const text   = isDarkMode ? '#ffffff' : '#111827';
  const sub    = isDarkMode ? '#9CA3AF' : '#6B7280';
  const border = isDarkMode ? '#374151' : '#E5E7EB';

  const y = view.getFullYear(), mo = view.getMonth();
  const firstDow = new Date(y, mo, 1).getDay();
  const dim = new Date(y, mo + 1, 0).getDate();

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sel = new Date(value); sel.setHours(0, 0, 0, 0);

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];

  const d2date = (d: number) => { const dt = new Date(y, mo, d); dt.setHours(0,0,0,0); return dt; };
  const isSel     = (d: number) => d2date(d).getTime() === sel.getTime();
  const isToday   = (d: number) => d2date(d).getTime() === today.getTime();
  const isDisabled = (d: number) => !!minDate && d2date(d) < today;

  const navBtn = (label: string, onClick: () => void) => (
    // @ts-ignore
    <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: sub, fontSize: 22, lineHeight: 1, padding: '0 8px', fontFamily: FONT }}>
      {label}
    </button>
  );

  return (
    // @ts-ignore
    <div style={{ background: bg, borderRadius: 14, padding: 16, marginTop: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.22)', border: `1px solid ${border}`, fontFamily: FONT }}>

      {/* Month navigation */}
      {/* @ts-ignore */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        {navBtn('‹', () => setView(new Date(y, mo - 1, 1)))}
        {/* @ts-ignore */}
        <span style={{ color: text, fontWeight: 700, fontSize: 15 }}>{MONTHS[mo]} {y}</span>
        {navBtn('›', () => setView(new Date(y, mo + 1, 1)))}
      </div>

      {/* Day-of-week headers */}
      {/* @ts-ignore */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {DAYS.map(d => (
          // @ts-ignore
          <div key={d} style={{ textAlign: 'center', color: sub, fontSize: 11, fontWeight: 600, padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      {/* @ts-ignore */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const s = isSel(d), t = isToday(d), dis = isDisabled(d);
          return (
            // @ts-ignore
            <div
              key={i}
              onClick={() => !dis && onChange(d2date(d))}
              style={{
                textAlign: 'center', padding: '8px 0', borderRadius: 8, fontSize: 13,
                cursor: dis ? 'default' : 'pointer',
                userSelect: 'none',
                color: s ? '#fff' : t ? '#00C870' : dis ? (isDarkMode ? '#4B5563' : '#D1D5DB') : text,
                background: s ? '#00C870' : 'transparent',
                fontWeight: (s || t) ? 700 : 400,
                outline: (t && !s) ? '2px solid #00C870' : 'none',
                outlineOffset: '-2px',
              }}
            >{d}</div>
          );
        })}
      </div>

      {/* Footer */}
      {/* @ts-ignore */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: `1px solid ${border}` }}>
        {/* @ts-ignore */}
        <button onClick={() => { onChange(null); onClose(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00C870', fontFamily: FONT, fontSize: 13, fontWeight: 700 }}>Clear</button>
        {/* @ts-ignore */}
        <button onClick={() => { onChange(new Date()); onClose(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00C870', fontFamily: FONT, fontSize: 13, fontWeight: 700 }}>Today</button>
        {/* @ts-ignore */}
        <button onClick={onClose} style={{ background: '#00C870', border: 'none', cursor: 'pointer', color: '#fff', fontFamily: FONT, fontSize: 13, fontWeight: 700, borderRadius: 8, padding: '7px 20px' }}>Done</button>
      </div>
    </div>
  );
}
