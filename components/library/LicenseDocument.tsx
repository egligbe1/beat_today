'use client'

import React from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'

/**
 * Renders a plain-text beat license as a nicely formatted, highlighted
 * document: numbered sections, lettered clauses with their CAPS lead-term
 * emphasized, restriction words ("NOT") flagged, and IMPORTANT NOTICE callouts.
 */

type Block =
  | { kind: 'title'; text: string }
  | { kind: 'section'; num: string; text: string }
  | { kind: 'item'; letter: string; text: string }
  | { kind: 'notice'; text: string }
  | { kind: 'party'; label: string; value: string }
  | { kind: 'track'; text: string }
  | { kind: 'divider' }
  | { kind: 'para'; text: string }
  | { kind: 'footer'; lines: { label: string; value: string }[] }

function parse(text: string): Block[] {
  const lines = text.replace(/\r/g, '').split('\n')
  const blocks: Block[] = []
  let titleTaken = false

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    if (!line) continue

    // Document footprint footer — collect the rest as label/value pairs.
    if (/DOCUMENT FOOTPRINT/i.test(line)) {
      const footerLines: { label: string; value: string }[] = []
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j].trim()
        if (!l || /^[-─—]+$/.test(l)) continue
        const m = l.match(/^([^:]+):\s*(.+)$/)
        if (m) footerLines.push({ label: m[1].trim(), value: m[2].trim() })
      }
      blocks.push({ kind: 'footer', lines: footerLines })
      break
    }

    if (/^[─—_-]{6,}$/.test(line)) { blocks.push({ kind: 'divider' }); continue }

    if (!titleTaken && /AGREEMENT|LICENSE|RIGHTS/i.test(line) && line === line.toUpperCase()) {
      blocks.push({ kind: 'title', text: line }); titleTaken = true; continue
    }

    const notice = line.match(/^IMPORTANT NOTICE:?\s*(.*)$/i)
    if (notice) { blocks.push({ kind: 'notice', text: notice[1] || raw }); continue }

    const party = line.match(/^(Producer \/ Licensor|Purchaser \/ Licensee)\s*:\s*(.+)$/i)
    if (party) { blocks.push({ kind: 'party', label: party[1], value: party[2] }); continue }

    if (/^".+"\s*\(/.test(line)) { blocks.push({ kind: 'track', text: line }); continue }

    const section = line.match(/^(\d+)\.\s+(.+)$/)
    if (section && section[2] === section[2].toUpperCase()) {
      blocks.push({ kind: 'section', num: section[1], text: section[2] }); continue
    }

    const item = line.match(/^([a-z])\)\s+(.+)$/)
    if (item) { blocks.push({ kind: 'item', letter: item[1], text: item[2] }); continue }

    blocks.push({ kind: 'para', text: line })
  }

  return blocks
}

// Inline emphasis: flag "NOT", quoted terms, and "Prod. by ..." credits.
function inline(text: string): React.ReactNode {
  const parts = text.split(/(\bNOT\b|"[^"]+")/g)
  return parts.map((p, i) => {
    if (p === 'NOT') return <span key={i} className="font-bold text-red-600">NOT</span>
    if (/^".+"$/.test(p)) return <span key={i} className="font-semibold text-zinc-900">{p}</span>
    return <React.Fragment key={i}>{p}</React.Fragment>
  })
}

// A clause whose text begins with "TERM — rest": bold the lead term.
function clause(text: string): React.ReactNode {
  const m = text.match(/^([A-Z][A-Z0-9 /&-]{1,30})\s—\s(.+)$/)
  if (m) {
    return (
      <>
        <span className="font-bold text-accent-orange uppercase tracking-wide">{m[1].trim()}</span>
        <span className="text-zinc-400"> — </span>
        {inline(m[2])}
      </>
    )
  }
  return inline(text)
}

export default function LicenseDocument({ text }: { text: string }) {
  const blocks = parse(text)

  return (
    <div className="rounded-2xl bg-[#faf9f7] text-zinc-700 shadow-inner ring-1 ring-black/5 px-6 sm:px-10 py-8 sm:py-10 leading-relaxed">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'title':
            return (
              <div key={i} className="mb-6 pb-5 border-b-2 border-zinc-900/10">
                <div className="flex items-center gap-2 text-accent-orange mb-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em]">Official License</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight uppercase leading-tight">{b.text}</h1>
              </div>
            )
          case 'party':
            return (
              <div key={i} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 my-1.5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 w-40 flex-shrink-0">{b.label}</span>
                <span className="font-bold text-zinc-900">{b.value}</span>
              </div>
            )
          case 'track':
            return (
              <div key={i} className="my-4 rounded-xl bg-accent-orange/5 border border-accent-orange/20 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-accent-orange mb-0.5">The Beat</p>
                <p className="text-lg font-black text-zinc-900">{b.text.replace(/\s*\(.*$/, '')}</p>
              </div>
            )
          case 'notice':
            return (
              <div key={i} className="my-5 flex gap-3 rounded-xl bg-amber-50 border border-amber-300 px-4 py-3.5">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Important Notice</p>
                  <p className="text-sm text-amber-900 font-medium">{b.text}</p>
                </div>
              </div>
            )
          case 'divider':
            return <hr key={i} className="my-6 border-zinc-900/10" />
          case 'section':
            return (
              <div key={i} className="flex items-center gap-3 mt-7 mb-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-zinc-900 text-white text-xs font-black flex items-center justify-center">{b.num}</span>
                <h2 className="text-sm font-black text-zinc-900 uppercase tracking-widest">{b.text}</h2>
              </div>
            )
          case 'item':
            return (
              <div key={i} className="flex gap-3 my-2 pl-1">
                <span className="flex-shrink-0 w-5 h-5 mt-0.5 rounded-md bg-zinc-200 text-zinc-600 text-[10px] font-black flex items-center justify-center uppercase">{b.letter}</span>
                <p className="text-[13.5px] text-zinc-600 flex-1">{clause(b.text)}</p>
              </div>
            )
          case 'footer':
            return (
              <div key={i} className="mt-8 pt-5 border-t-2 border-dashed border-zinc-900/15">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Document Footprint</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
                  {b.lines.map((l, j) => (
                    <div key={j} className="flex items-baseline gap-2 text-xs">
                      <span className="font-bold uppercase tracking-wider text-zinc-400">{l.label}:</span>
                      <span className="font-semibold text-zinc-700">{l.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          default:
            return <p key={i} className="text-[13.5px] text-zinc-600 my-2">{inline(b.text)}</p>
        }
      })}
    </div>
  )
}
