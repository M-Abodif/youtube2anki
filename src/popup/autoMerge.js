// @ts-nocheck
/**
 * Smart auto-merge (punctuation based).
 *
 * Walks the subtitles in order and groups consecutive enabled cards until one of them
 * ends in terminal punctuation (. ? !) or the group reaches `maxDuration` seconds,
 * so each resulting card holds whole sentences (or about 10 seconds of speech).
 *
 * A merged card is built exactly like the manual merge in List.js:
 * it keeps the first card (time, startSeconds, hash...) and takes endSeconds,
 * nextTime and nextText from the last one. endSeconds already carries the
 * +1s padding added by the content script, so no extra padding is added.
 * The original cards are kept in `mergedFrom`, so "Unmerge" still works.
 *
 * Disabled (unselected) cards are never merged and break a chain.
 *
 * Note: the YouTube transcript has no end time per line (endSeconds = next start + 1),
 * so pauses between lines cannot be detected from this data.
 */

// Terminal punctuation, optionally followed by closing quotes/brackets: `done."` `(really?)`
const TERMINAL_PUNCTUATION = /[.?!]["'”’)\]]*$/

/**
 * @param {string} text
 */
export const endsSentence = (text) => TERMINAL_PUNCTUATION.test(String(text ?? '').trim())

/**
 * Builds a single card from consecutive cards
 *
 * @param {Subtitle[]} cards
 * @returns {Subtitle}
 */
const mergeGroup = (cards) => {
  const firstCard = cards[0]
  const lastCard = cards[cards.length - 1]

  return {
    ...firstCard,
    // time و startSeconds يأتيان من نفس النص في الصفحة (startSeconds = toSeconds(time)) فهما متطابقان أصلًا،
    // لذلك نُبقي time كما هو ولا نعيد تنسيقه (إعادة التنسيق كانت تعطي NaN:NaN لآخر بطاقة، و 61:40 بدل 1:01:40)
    text: cards.map(({ text }) => String(text ?? '').trim()).join(' '),
    endSeconds: lastCard.endSeconds,
    nextTime: lastCard.nextTime || lastCard.time,
    nextText: lastCard.nextText,
    // لا نرث originalText الخاص بالبطاقة الأولى فقط (يكسر زر Undo بعد الدمج)
    originalText: undefined,
    // Keep the original cards so the merge can be undone
    mergedFrom: cards.map(card => ({ ...card }))
  }
}

/**
 * @param {Subtitle[]} subtitles All the cards, in transcript order
 * @param {{ maxDuration?: number }} [options]
 *   maxDuration: أقصى مدة للكارت بالثواني
 * @returns {Subtitle[]} A new list; the input is not modified
 */
export const autoMergeByPunctuation = (subtitles, { maxDuration = 10 } = {}) => {
  /** @type {Subtitle[]} */
  const result = []
  /** @type {Subtitle[]} */
  let group = []
  let groupStartTime = NaN

  const flush = () => {
    if (group.length > 1) {
      result.push(mergeGroup(group))
    } else if (group.length === 1) {
      result.push(group[0])
    }
    group = []
    groupStartTime = NaN
  }

  for (const subtitle of subtitles ?? []) {
    // تخطي الكروت المعطلة وإنهاء المجموعة الحالية
    if (subtitle.disabled) {
      flush()
      result.push(subtitle)
      continue
    }

    if (group.length === 0) {
      groupStartTime = parseFloat(subtitle.startSeconds)
    }

    group.push(subtitle)

    // آخر بطاقة في الفيديو endSeconds لها null => NaN => المقارنة false، وتُغلق المجموعة بعد الحلقة
    const duration = parseFloat(subtitle.endSeconds) - groupStartTime

    // شروط الإغلاق: علامة ترقيم، أو تجاوز المدة القصوى
    if (endsSentence(subtitle.text) || duration >= maxDuration) {
      flush()
    }
  }

  flush()

  return result
}

/**
 * @typedef {import('../interfaces').Subtitle} Subtitle
 */