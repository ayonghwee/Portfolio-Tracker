'use client'
import { useState, useEffect, useRef, useMemo } from 'react'

// Complete GreatLink fund list with GE API codes
export const FUND_CODE_MAP = {
  'GreatLink ASEAN Growth Fund':                    'FS02',
  'GreatLink Asia Dividend Advantage Fund':          'F227',
  'GreatLink Asia High Dividend Equity Fund':        'FS05',
  'GreatLink Asia Pacific Equity Fund':              'FS03',
  'GreatLink Cash Fund':                             'FS01',
  'GreatLink China Growth Fund':                     'FS32',
  'GreatLink Diversified Growth Portfolio':          'F212',
  'GreatLink Dynamic Balanced Portfolio':            'F229',
  'GreatLink Dynamic Growth Portfolio':              'F230',
  'GreatLink Dynamic Secure Portfolio':              'F228',
  'GreatLink European Sustainable Equity Fund':      'FS06',
  'GreatLink Far East Ex Japan Equities Fund':       'FS17',
  'GreatLink Global Bond Fund':                      'FS12',
  'GreatLink Global Disruptive Innovation Fund':     'F224',
  'GreatLink Global Emerging Markets Equity Fund':   'FS175',
  'GreatLink Global Equity Alpha Fund':              'FS19',
  'GreatLink Global Equity Fund':                    'FS07',
  'GreatLink Global Perspective Fund':               'FS16',
  'GreatLink Global Real Estate Securities Fund':    'FS26',
  'GreatLink Global Supreme Fund':                   'FS04',
  'GreatLink Global Technology Fund':                'FS09',
  'GreatLink Income Bond Fund':                      'FS216',
  'GreatLink Income Focus Fund':                     'FS34',
  'GreatLink International Health Care Fund':        'F222',
  'GreatLink Lifestyle Balanced Portfolio':          'FS23',
  'GreatLink Lifestyle Dynamic Portfolio':           'FS25',
  'GreatLink Lifestyle Progressive Portfolio':       'FS24',
  'GreatLink Lifestyle Secure Portfolio':            'FS21',
  'GreatLink Lifestyle Steady Portfolio':            'FS22',
  'GreatLink Lion Asian Balanced Fund':              'FS35',
  'GreatLink Lion India Fund':                       'FS33',
  'GreatLink Lion Japan Growth Fund':                'FS31',
  'GreatLink Lion Vietnam Fund':                     'FS36',
  'GreatLink Multi-Sector Income Fund':              'F226',
  'GreatLink Multi-Theme Equity Fund':               'F213',
  'GreatLink Short Duration Bond Fund':              'FS20',
  'GreatLink Singapore Equities Fund':               'FS18',
  'GreatLink Singapore Physical Gold Fund':          'F231',
  'GreatLink Sustainable Global Thematic Fund':      'FS11',
  'GreatLink US Income and Growth Fund (Dis)':       'F225',
}

export const ALL_FUNDS = Object.keys(FUND_CODE_MAP)

export default function FundTypeahead({ value, onChange, placeholder, label, className }) {
  const [query, setQuery]     = useState('')
  const [open, setOpen]       = useState(false)
  const [highlight, setHL]    = useState(0)
  const inputRef              = useRef(null)
  const listRef               = useRef(null)

  // Sync display text when value changes externally
  useEffect(() => {
    setQuery(value ? value.replace('GreatLink ', '') : '')
  }, [value])

  const filtered = useMemo(() => {
    if (!query) return ALL_FUNDS
    const q = query.toLowerCase()
    return ALL_FUNDS.filter(f =>
      f.toLowerCase().includes(q) ||
      (FUND_CODE_MAP[f] || '').toLowerCase().includes(q)
    )
  }, [query])

  function select(fundName) {
    onChange(fundName)
    setQuery(fundName.replace('GreatLink ', ''))
    setOpen(false)
    setHL(0)
  }

  function handleKey(e) {
    if (!open) { if (e.key === 'ArrowDown' || e.key === 'Enter') setOpen(true); return }
    if (e.key === 'ArrowDown')  { setHL(h => Math.min(h + 1, filtered.length - 1)); e.preventDefault() }
    if (e.key === 'ArrowUp')    { setHL(h => Math.max(h - 1, 0)); e.preventDefault() }
    if (e.key === 'Enter')      { if (filtered[highlight]) select(filtered[highlight]); e.preventDefault() }
    if (e.key === 'Escape')     { setOpen(false) }
  }

  return (
    <div style={{ position: 'relative', width: '100%' }} className={className}>
      {label && (
        <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">{label}</div>
      )}
      <input
        ref={inputRef}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHL(0) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        onKeyDown={handleKey}
        placeholder={placeholder || 'Type fund name…'}
        autoComplete="off"
        style={{ width: '100%' }}
      />
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          style={{
            position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0,
            zIndex: 300, background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 4, maxHeight: 220, overflowY: 'auto',
            boxShadow: '0 6px 20px rgba(0,0,0,0.10)',
          }}
        >
          {filtered.map((f, i) => (
            <div
              key={f}
              onMouseDown={() => select(f)}
              style={{
                padding: '7px 10px',
                cursor: 'pointer',
                background: i === highlight ? '#f3f4f6' : '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
              }}
            >
              <span style={{ color: '#9ca3af', fontSize: 10, fontFamily: 'monospace', minWidth: 44 }}>
                {FUND_CODE_MAP[f]}
              </span>
              <span>{f.replace('GreatLink ', '')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
