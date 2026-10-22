/**
 * Smart auto-merge (punctuation based).
 *
 * Walks the subtitles in order and joins every enabled card that does not
 * end in terminal punctuation (. ? !) with the enabled card that follows it,
 * so each resulting card holds whole sentences.
 *
 * A merged card is built exactly like the manual merge in List.js:
 * it keeps the first card (time, startSeconds, hash...) and takes endSeconds,
 * nextTime and nextText from the last one. endSeconds already carries the
 * +1s padding added by the content script, so no extra padding is added.
 * The original cards are kept in `mergedFrom`, so "Undo merge" still works.
 *
 * Disabled (unselected) cards are never merged and break a chain.
 */

// Terminal punctuation, optionally followed by closing quotes/brackets: `done."` `(really?)`
const TERMINAL_PUNCTUATION = /[.?!]["'”’)\]]*$/

/**
 * @param {string} text
 */
export const endsSentence = (text) => TERMINAL_PUNCTUATION.test(text.trim())

/**
 * Builds a single card from consecutive cards
 *
 * @param {Subtitle[]} cards
 * @returns {Subtitle}
 */
const mergeGroup = (cards) => {
  const lastCard = cards[cards.length - 1]
  return {
    ...cards[0],
    text: cards.map(({ text }) => text).join(' '),
    endSeconds: lastCard.endSeconds,
    nextTime: lastCard.nextTime,
    nextText: lastCard.nextText,
    // Keep the original cards so the merge can be undone
    mergedFrom: cards.map(card => ({ ...card }))
  }
}

/**
 * @param {Subtitle[]} subtitles All the cards, in transcript order
 * @param {{ maxDuration?: number, silenceGap?: number }} [options]
 *   maxDuration: أقصى مدة للكارت بالثواني (مثلاً 10 ثوانٍ)
 *   silenceGap: فترة الصمت التي تعتبر نهاية جملة (مثلاً 0.6 ثانية)
 * @returns {Subtitle[]} A new list; the input is not modified
 */
export const autoMergeByPunctuation = (subtitles, { maxDuration = 10, silenceGap = 0.6 } = {}) => {
  /** @type {Subtitle[]} */
  const result = []
  /** @type {Subtitle[]} */
  let group = []
  let groupStartTime = null

  const flush = () => {
    if (group.length > 1) {
      result.push(mergeGroup(group))
    } else if (group.length === 1) {
      result.push(group[0])
    }
    group = []
    groupStartTime = null
  }

  for (let i = 0; i < subtitles.length; i++) {
    const subtitle = subtitles[i]

    // تخطي الكروت المعطلة وإرسال المجموعة الحالية
    if (subtitle.disabled) {
      flush()
      result.push(subtitle)
      continue
    }

    if (group.length === 0) {
      groupStartTime = parseFloat(subtitle.startSeconds)
    }
    
    group.push(subtitle)

    const currentEndTime = parseFloat(subtitle.endSeconds)
    const duration = currentEndTime - groupStartTime

    // اكتشاف فترات الصمت بين الكتلة الحالية والتي تليها
    const nextSubtitle = subtitles[i + 1]
    let isSilence = false
    if (nextSubtitle && !nextSubtitle.disabled) {
      const nextStartTime = parseFloat(nextSubtitle.startSeconds)
      isSilence = (nextStartTime - currentEndTime) >= silenceGap
    } else if (!nextSubtitle) {
      isSilence = true // نهاية الفيديو
    }

    // شروط الدمج: علامة ترقيم، أو تجاوز المدة القصوى، أو وجود فترة صمت
    if (endsSentence(subtitle.text) || duration >= maxDuration || isSilence) {
      flush()
    }
  }
  
  flush()

  return result
}
