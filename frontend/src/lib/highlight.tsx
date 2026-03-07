import React from 'react'

/**
 * Extract meaningful keywords from a user query string.
 * Uses Chinese character segmentation (bigram) + whitespace splitting for non-Chinese.
 */
export function extractKeywords(query: string): string[] {
  if (!query.trim()) return []

  const keywords: string[] = []

  // Extract Chinese segments (2+ chars)
  const chineseSegments = query.match(/[\u4e00-\u9fff]{2,}/g) || []
  for (const seg of chineseSegments) {
    if (seg.length <= 4) {
      keywords.push(seg)
    } else {
      // Sliding window: 2-4 char bigrams
      for (let len = 2; len <= Math.min(4, seg.length); len++) {
        for (let i = 0; i <= seg.length - len; i++) {
          keywords.push(seg.slice(i, i + len))
        }
      }
    }
  }

  // Extract non-Chinese words (3+ chars to skip noise)
  const nonChinese = query.replace(/[\u4e00-\u9fff]+/g, ' ').trim()
  if (nonChinese) {
    const words = nonChinese.split(/\s+/).filter(w => w.length >= 3)
    keywords.push(...words)
  }

  // Deduplicate, prefer longer keywords first
  const unique = [...new Set(keywords)].sort((a, b) => b.length - a.length)
  return unique.slice(0, 15)
}

/**
 * Render text with keyword highlights.
 * Wraps matched substrings in <mark> with a yellow background.
 */
export function HighlightText({ text, keywords }: { text: string; keywords: string[] }) {
  if (!text || !keywords.length) return <>{text}</>

  // Build regex from keywords, escape special chars
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')

  const parts = text.split(pattern)
  if (parts.length <= 1) return <>{text}</>

  return (
    <>
      {parts.map((part, i) =>
        pattern.test(part) ? (
          <mark key={i} className="bg-yellow-200 text-inherit rounded-sm px-0.5">{part}</mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  )
}
