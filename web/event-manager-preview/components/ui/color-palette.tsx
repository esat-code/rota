import React, {useRef} from 'react';
import {Check, Slash} from 'lucide-react';

// Keep these IDs stable: saved events and active filters use them.
export const COLORS = [
  ['blue', 'Mavi', '#3b9fff'],
  ['green', 'Yeşil', '#65ba8c'],
  ['purple', 'Mor', '#aa8ddd'],
  ['orange', 'Turuncu', '#daa76d'],
  ['pink', 'Pembe', '#ce8eaa'],
  ['red', 'Kırmızı', '#df7f79'],
  ['none', 'Renksiz', 'transparent'],
] as const;

export const colorValue = (id: string) => COLORS.find(color => color[0] === id)?.[2] ?? COLORS[0][2];

type ColorPaletteProps = {
  value?: string;
  values?: string[];
  onChange: (id: string) => void;
  multiple?: boolean;
  label?: string;
};

export function ColorPalette({value, values = [], onChange, multiple = false, label = 'Renk seçimi'}: ColorPaletteProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.max(0, COLORS.findIndex(color => color[0] === value));

  function navigate(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (multiple) return;
    let target = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = (index + 1) % COLORS.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = (index - 1 + COLORS.length) % COLORS.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = COLORS.length - 1;
    else return;
    event.preventDefault();
    buttons.current[target]?.focus();
    onChange(COLORS[target][0]);
  }

  return <div className="color-palette" role={multiple ? 'group' : 'radiogroup'} aria-label={label}>
    {COLORS.map(([id, name, hex], index) => {
      const selected = multiple ? values.includes(id) : value === id;
      return <button
        key={id}
        ref={element => { buttons.current[index] = element; }}
        type="button"
        className={'color-palette__choice' + (id === 'none' ? ' color-palette__choice--none' : '') + (selected ? ' color-palette__choice--selected' : '')}
        style={{'--palette-color': hex} as React.CSSProperties}
        aria-label={name}
        role={multiple ? undefined : 'radio'}
        aria-checked={multiple ? undefined : selected}
        aria-pressed={multiple ? selected : undefined}
        tabIndex={multiple || activeIndex === index ? 0 : -1}
        onClick={() => onChange(id)}
        onKeyDown={event => navigate(event, index)}
      >
        <span className="color-palette__swatch" aria-hidden="true">{id === 'none' ? <Slash size={17} strokeWidth={1.8}/> : selected && <Check size={17} strokeWidth={3}/>}</span>
        {id === 'none' && selected && <span className="color-palette__none-check" aria-hidden="true"><Check size={10} strokeWidth={3}/></span>}
      </button>;
    })}
  </div>;
}
