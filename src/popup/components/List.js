import { elementFactory } from '../skruv-0.7.7/skruv.js'
import { state as mainState } from '../state.js'
import { getEnabledSubtitles } from '../utils.js'
import { autoMergeByPunctuation } from '../autoMerge.js'

// تمت إضافة h3 و p هنا لدعم النافذة المنبثقة
// تمت إضافة input لدعم شريط الانتقال السريع
const { div, span, ul, li, button, h2, h3, p, input } = elementFactory
import { css } from '../skruv-0.7.7/utils/css.js'

// -- التعديل الجديد: متغير لحفظ آخر كارت تم النقر عليه لدعم Shift-Click --
let lastCheckedIndex = null;

/**
- Gets all the cards that will be merged
- according to the current selection
 */
const getCardsToMerge = () => {
  if (isNaN(mainState.mergeStart) || isNaN(mainState.mergeEnd)) {
    return []
  }

  if (mainState.mergeStart <= mainState.mergeEnd) {
    return mainState.subtitles
      .slice(mainState.mergeStart, mainState.mergeEnd + 1)
      .map(v => ({ ...v }))
  }

  return mainState.subtitles
    .slice(mainState.mergeEnd, mainState.mergeStart + 1)
    .map(v => ({ ...v }))
}

/**
- Generates a single card from cardsToMerge
- and replaces it in the subtitles state
 *
- 
@param {Subtitle[]} cardsToMerge
 */
const mergeCards = (cardsToMerge) => {
  const lastCard = cardsToMerge[cardsToMerge.length - 1]
  const card = {
    ...cardsToMerge[0],
    text: cardsToMerge.map(({ text }) => text).join(' '),
    endSeconds: lastCard.endSeconds,
    nextTime: lastCard.nextTime,
    nextText: lastCard.nextText,
    // Keep the original cards so the merge can be undone
    mergedFrom: cardsToMerge
  }

  if (mainState.mergeStart < mainState.mergeEnd) {
    mainState.subtitles = [
      ...mainState.subtitles.slice(0, mainState.mergeStart),
      card,
      ...mainState.subtitles.slice(mainState.mergeEnd + 1, mainState.subtitles.length)
    ];

    /** @type {HTMLElement} */(document.querySelector(`[data-index="${mainState.mergeStart}"]`))?.scrollIntoView({ behavior: 'smooth' })
  } else {
    mainState.subtitles = [
      ...mainState.subtitles.slice(0, mainState.mergeEnd),
      card,
      ...mainState.subtitles.slice(mainState.mergeStart + 1, mainState.subtitles.length)
    ];

    /** @type {HTMLElement} */(document.querySelector(`[data-index="${mainState.mergeEnd}"]`))?.scrollIntoView({ behavior: 'smooth' })
  }

  mainState.mergeStart = NaN
  mainState.mergeEnd = NaN
}

/**
- Restores the original cards of a merged card
- back into the subtitles state
 *
- 
@param {number} index
 */
const unmergeCard = (index) => {
  const mergedFrom = mainState.subtitles[index].mergedFrom
  if (!mergedFrom?.length) {
    return
  }

  mainState.subtitles = [
    ...mainState.subtitles.slice(0, index),
    ...mergedFrom.map(v => ({ ...v })),
    ...mainState.subtitles.slice(index + 1, mainState.subtitles.length)
  ]

  mainState.mergeStart = NaN
  mainState.mergeEnd = NaN
}

/**
- Merges every enabled card that does not end in terminal punctuation (. ? !)
- with the enabled card that follows it, and replaces them in the subtitles state
 */
const autoMergeCards = () => {
  mainState.subtitles = autoMergeByPunctuation(mainState.subtitles)
  mainState.mergeStart = NaN
  mainState.mergeEnd = NaN
}

// @ts-ignore
const styling = css`
  :scope  {
    display: flex;
    flex-direction: column;
    max-height: 600px;
    padding-right: 0;
    align-items: center;
    padding: 10px 0;
    gap: 0.5rem;
    position: relative;
  }

  .controls {
    display: flex;
    gap: .4rem;
    align-items: center;
    font-size: 1rem;
    width: 100%;
    padding: 0 .5rem;
    flex-wrap: wrap; 
    justify-content: center;
  }

  .controls .btn {
    padding-left: 1rem;
    padding-right: 1rem;
  }
  .controls h2 {
    flex: 1;
    text-align: center;
    min-width: 100%; 
    margin-bottom: 5px;
  }

  .jump-controls {
    display: flex;
    gap: 5px;
    width: 100%;
    margin-top: 5px;
    margin-bottom: 10px;
    padding: 0 .5rem;
  }

  .jump-input {
    flex: 1;
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid var(--action-color);
    background-color: var(--main-bg-color);
    color: var(--p-color);
    font-size: 0.9rem;
    outline: none;
  }
  
  .jump-input:focus {
    box-shadow: inset 0 0 0 1px var(--action-color);
  }

  .jump-btn {
    background-color: transparent;
    border: 1px solid var(--action-color);
    color: var(--action-color);
    padding: 6px 15px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    transition: all 0.2s;
  }

  .jump-btn:hover {
    background-color: var(--action-color);
    color: var(--main-bg-color);
  }

  ul {
    list-style-type: none;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    overflow-y: auto;
    width: 100%;
    flex: 1;
  }

  ul::-webkit-scrollbar {
    width: 6px; 
  }
  ul::-webkit-scrollbar-track {
    background: transparent; 
  }
  ul::-webkit-scrollbar-thumb {
    background-color: rgba(150, 150, 150, 0.4); 
    border-radius: 10px; 
  }
  ul::-webkit-scrollbar-thumb:hover {
    background-color: var(--action-color); 
  }
  
  li {
    position: relative;
    scroll-margin-top: 50px; 
  }

  .mergedBadge {
    color: var(--action-color);
    font-size: .75rem;
    font-weight: bold;
    margin-left: .3rem;
  }

  .text {
    padding: 10px 15px;
    flex: 1;
    text-align: left;
    line-height: 1.4; 
    position: relative;
  }

  .text:hover::after {
    content: ' ✏️';
    position: absolute;
    right: 5px;
    opacity: 0.6;
    font-size: 0.8rem;
  }

  .disabled {
    text-decoration: line-through;
    opacity: 0.6; 
    background-color: rgba(150, 150, 150, 0.05); 
    transition: opacity 0.3s ease;
  }

  .toggle-checkbox {
    width: 18px;
    height: 18px;
    min-width: 18px;
    border: 2px solid var(--action-color);
    border-radius: 4px;
    margin-right: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .listButton:not(.disabled) .toggle-checkbox {
    background-color: var(--action-color);
  }
  .listButton:not(.disabled) .toggle-checkbox::after {
    content: '✓';
    color: var(--main-bg-color, white);
    font-size: 12px;
    font-weight: bold;
  }

  .disabled .toggle-checkbox {
    border-color: var(--p-color);
    background-color: transparent;
  }

  .listButton {
    width: 100%;
    display: flex;
    align-items: center;
    cursor: pointer;
    margin: 0;
    padding: 10px;
    border: none;
    background: transparent;
    outline: none;
    transition: background .3s ease-in-out; 
  }

  .listButton:focus {
    background-color: var(--main-bg-color);
    box-shadow: inset 0 0 0 2px var(--action-color);
    border-radius: 4px;
    z-index: 2;
  }

  .inRange {
    background-color: var(--action-disabled-color) !important;
    cursor: copy;
  }

  .reset {
    position: absolute;
    left: 50%;
    top: .2rem;
    border: none;
    background: none;
    color: var(--p-color);
    transform: translateX(-50%);
    font-size: .7rem;
  }

  .reset:hover {
    color: var(--action-color);
  }

  .selectBtn {
    padding-top: .2rem;
    padding-bottom: .2rem;
  }

  .text[contenteditable="true"]:hover {
    background-color: rgba(150, 150, 150, 0.1);
    cursor: text;
    border-radius: 4px;
  }

  .text[contenteditable="true"]:focus {
    background-color: var(--main-bg-color);
    outline: 1px solid var(--action-color);
  }

  .resetTextBtn {
    background: none;
    border: none;
    color: var(--action-color);
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0 8px;
    transition: transform 0.2s ease, color 0.2s ease;
  }

  .resetTextBtn:hover {
    color: #ff4757; 
    transform: rotate(-45deg); 
  } 

  .export-container {
    position: sticky;
    bottom: 0;
    background-color: var(--main-bg-color, #ffffff);
    width: 100%;
    padding: 15px 0 5px 0;
    z-index: 10;
    display: flex;
    justify-content: center;
    border-top: 1px solid rgba(150, 150, 150, 0.2);
    margin-top: 10px;
  }

  .btn-export {
    background-color: #2ed573 !important; 
    color: #ffffff !important;
    border-color: #2ed573 !important;
    padding: 10px 24px;
    font-weight: bold;
    font-size: 1.05rem;
    box-shadow: 0 4px 6px rgba(46, 213, 115, 0.2);
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .btn-export:hover {
    background-color: #26b360 !important;
    transform: translateY(-2px);
    box-shadow: 0 6px 8px rgba(46, 213, 115, 0.3);
  }

  .custom-modal-overlay {
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(3px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    animation: fadeIn 0.2s ease-in-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .custom-modal {
    background: var(--main-bg-color, #ffffff);
    padding: 25px;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    max-width: 85%;
    border: 1px solid var(--action-color);
  }

  .custom-modal h3 {
    margin-top: 0;
    color: #ff4757;
    font-size: 1.2rem;
    margin-bottom: 10px;
  }

  .custom-modal p {
    font-size: 0.95rem;
    color: var(--p-color);
    margin-bottom: 25px;
    line-height: 1.4;
  }

  .custom-modal-actions {
    display: flex;
    gap: 15px;
    justify-content: center;
  }

  .btn-danger {
    background-color: #ff4757 !important;
    color: white !important;
  }

  .btn-danger:hover {
    background-color: #ff6b81 !important;
  }

  .btn-cancel {
    background-color: transparent !important;
    border: 1px solid var(--p-color) !important;
    color: var(--p-color) !important;
  }

  .btn-cancel:hover {
    background-color: rgba(150, 150, 150, 0.1) !important;
  }

  .card-actions {
    display: none; 
    flex-direction: column; 
    align-items: center;
    gap: 8px; 
    padding: 0 10px 15px 10px;
  }

  li:hover .card-actions,
  li:focus-within .card-actions {
    display: flex;
  }

  .card-actions .btn {
    width: 80%; 
    font-size: 0.85rem;
    padding: 6px;
    border-radius: 6px;
  }

  .card-actions .hidden {
    display: none !important;
  }
`

/**
- Toggle the item between enabled and disabled with Shift-Click support
 *
- 
@param {MouseEvent | KeyboardEvent} e 
- 
@param {number} index
 */
const toggleItem = (e, index) => {
  const targetState = !mainState.subtitles[index].disabled;

  // -- التعديل الجديد: تنفيذ التحديد المتعدد السريع --
  if (e && e.shiftKey && lastCheckedIndex !== null) {
    const start = Math.min(lastCheckedIndex, index);
    const end = Math.max(lastCheckedIndex, index);

    for (let i = start; i <= end; i++) {
      mainState.subtitles[i].disabled = targetState;
    }
  } else {
    mainState.subtitles[index].disabled = targetState;
  }

  // تحديث المؤشر لآخر كارت تم النقر عليه
  lastCheckedIndex = index;
}

/**
- Sets all items a enabled/disabled
 *
- 
@param {boolean} state
 */
const setAll = (state) => {
  mainState.subtitles.forEach(item => {
    item.disabled = state
  })
}

/**
 *
- 
@param {string} storageId
 */
export const List = (storageId) => {
  const enabledCards = getEnabledSubtitles(mainState.subtitles).length
  const cardsToMerge = getCardsToMerge()
  const canAutoMerge = autoMergeByPunctuation(mainState.subtitles).length < mainState.subtitles.length

  return div(
    {
      class: `card ${styling}`
    },
    div(
      {
        class: 'controls'
      },
      h2({}, chrome.i18n.getMessage('listSelect')),
      button({
        disabled: enabledCards === mainState.subtitles.length || undefined,
        class: 'btn selectBtn',
        onclick: () => setAll(false)
      }, chrome.i18n.getMessage('listSelectAll')),
      button({
        class: 'btn selectBtn',
        disabled: enabledCards === 0 || undefined,
        onclick: () => setAll(true)
      }, chrome.i18n.getMessage('listSelectNone')),

      button({
        class: 'btn selectBtn btn-danger',
        title: 'Restore all original subtitles',
        onclick: () => {
          mainState.showResetModal = true;
        }
      }, 'Reset All'),

      button({
        class: 'btn selectBtn',
        title: chrome.i18n.getMessage('listAutoMergeTitle'),
        disabled: !canAutoMerge || undefined,
        onclick: autoMergeCards
      }, chrome.i18n.getMessage('listAutoMerge')),

      // -- شريط الانتقال وزر المزامنة --
      div({ class: 'jump-controls' },
        input({
          id: 'jump-time-input',
          class: 'jump-input',
          type: 'text',
          placeholder: 'e.g., 7 or 15:30',
          onkeydown: (e) => {
            if (e.key === 'Enter') {
              document.getElementById('jump-btn-action').click();
            }
          }
        }),
        button({
          id: 'jump-btn-action',
          class: 'jump-btn',
          onclick: () => {
            const timeValue = document.getElementById('jump-time-input').value.trim();
            if (!timeValue) return;

            const listItems = document.querySelectorAll('li');

            for (let li of listItems) {
              const timeSpan = li.querySelector('span:nth-child(2)');

              if (timeSpan && timeSpan.innerText.startsWith(timeValue)) {
                li.scrollIntoView({ behavior: 'smooth', block: 'center' });

                const btnInside = li.querySelector('.listButton');
                if (btnInside) {
                  const originalBg = btnInside.style.backgroundColor;
                  btnInside.style.backgroundColor = 'rgba(255, 71, 87, 0.2)';
                  setTimeout(() => {
                    btnInside.style.backgroundColor = originalBg;
                  }, 1500);
                }
                break;
              }
            }
          }
        }, 'Jump'),
        
        button({
          class: 'jump-btn',
          style: 'background-color: var(--action-color); color: white;',
          title: 'Scroll to current video time',
          onclick: () => {
            chrome.tabs.sendMessage(mainState.activeTabId, { type: 'getCurrentTime' }, (response) => {
              if (chrome.runtime.lastError || !response) return;

              const currentTime = response.currentTime;
              const listItems = document.querySelectorAll('li');

              for (let i = 0; i < mainState.subtitles.length; i++) {
                const sub = mainState.subtitles[i];
                if (currentTime >= sub.startSeconds && (!sub.endSeconds || currentTime < sub.endSeconds)) {
                  const targetLi = listItems[i];
                  if (targetLi) {
                    targetLi.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    const btnInside = targetLi.querySelector('.listButton');
                    if (btnInside) {
                      const originalBg = btnInside.style.backgroundColor;
                      btnInside.style.backgroundColor = 'rgba(46, 213, 115, 0.3)';
                      setTimeout(() => { btnInside.style.backgroundColor = originalBg; }, 2000);
                    }
                  }
                  break;
                }
              }
            });
          }
        }, '📍 Sync')
      )
    ),

    ul({},
      mainState.subtitles.map((item, i) => {
        const isInRange = cardsToMerge.some(card => card.hash === item.hash);

        return li({
          class: `${item.disabled ? 'disabled' : ''}${isInRange ? ' inRange' : ''}`
        },
          button({
            onmouseover: (event) => {
              event.currentTarget.focus()
              if (!isNaN(mainState.mergeStart)) {
                mainState.mergeEnd = i
              }
            },
            onfocus: () => {
              if (!isNaN(mainState.mergeStart)) {
                mainState.mergeEnd = i
              }
            },
            onkeydown: (e) => {
              if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                toggleItem(e, i); // تمرير الحدث (e) ليعمل التحديد السريع بالكيبورد أيضاً
              }
            },
            'data-index': i,
            class: `listButton${item.disabled ? ' disabled' : ''}`,
            onclick: (e) => { // استقبال الحدث (e) هنا
              toggleItem(e, i);
            }
          },
            span({
              class: 'toggle-checkbox',
              title: item.disabled ? 'Click to restore' : 'Click to delete/disable'
            }),

            span({
              style: 'display: inline-flex; align-items: center; gap: 4px; cursor: pointer;',
              title: 'Play video from this moment',
              onclick: (e) => {
                e.stopPropagation(); 

                const timeParts = item.time.split(':').map(Number);
                const seconds = timeParts.length === 2
                  ? timeParts[0] * 60 + timeParts[1]
                  : timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];

                chrome.tabs.sendMessage(mainState.activeTabId, {
                  type: 'seekTo',
                  timeSeconds: seconds
                }, () => {
                  if (chrome.runtime.lastError) { /* ignore */ }
                });
              }
            },
              item.time,
              span({ style: 'font-size: 0.75rem; color: var(--action-color);' }, '▶️')
            ),

            span({
              class: 'mergedBadge',
              title: item.mergedFrom?.length ? chrome.i18n.getMessage('listMergedCard', String(item.mergedFrom.length)) : undefined
            },
              item.mergedFrom?.length ? `×${item.mergedFrom.length}` : ''
            ),

            span({
              class: 'text',
              contenteditable: 'true',
              onclick: (e) => {
                e.stopPropagation();
              },
              onblur: (e) => {
                const target = e.currentTarget;
                if (!(target instanceof HTMLElement)) return;
                const newText = target.innerText.trim();

                if (item.text !== newText) {
                  if (mainState.subtitles[i].originalText === undefined) {
                    mainState.subtitles[i].originalText = item.text;
                  }
                  mainState.subtitles[i].text = newText;
                }
              },
              onkeydown: (e) => {
                const target = e.currentTarget;
                if (!(target instanceof HTMLElement)) return;

                if (e.key === 'Enter') {
                  e.preventDefault();
                  target.blur();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  target.innerText = item.text;
                  target.blur();
                }
              }
            },
              item.text
            ),

            (item.originalText !== undefined && item.originalText !== item.text) && button({
              class: 'resetTextBtn',
              title: 'Restore original text',
              onclick: (e) => {
                e.stopPropagation();
                mainState.subtitles[i].text = item.originalText;
                mainState.subtitles[i].originalText = undefined;
              }
            }, '↺'),
            span({},
              item.nextTime || ''
            )
          ),

          div({ class: 'card-actions' },
            button({
              class: 'btn',
              onclick: () => {
                if (isNaN(mainState.mergeStart)) {
                  mainState.mergeStart = i
                } else {
                  mainState.mergeStart = NaN
                  mainState.mergeEnd = NaN
                }
              }
            }, isNaN(mainState.mergeStart) ? chrome.i18n.getMessage('listMerge') : chrome.i18n.getMessage('listMergeStop')),

            button({
              class: `btn${cardsToMerge.length > 1 ? '' : ' hidden'}`,
              onclick: () => {
                mergeCards(getCardsToMerge())
              }
            }, chrome.i18n.getMessage('listMergeCards', String(cardsToMerge.length))),

            button({
              class: `btn${item.mergedFrom?.length && cardsToMerge.length <= 1 ? '' : ' hidden'}`,
              onclick: () => {
                unmergeCard(i)
              }
            }, chrome.i18n.getMessage('listUnmerge'))
          )
        )
      })
    ),

    div({ class: 'export-container' },
      enabledCards
        ? button(
          {
            class: 'btn btn-export',
            onclick: () => {
              mainState.view = 'export'
            }
          },
          chrome.i18n.getMessage('listExportCards', String(enabledCards)))
        : chrome.i18n.getMessage('listExportCardsMinimum')
    ),

    mainState.showResetModal ? div({ class: 'custom-modal-overlay' },
      div({ class: 'custom-modal' },
        h3({}, '⚠️ Confirm Reset'),
        p({}, 'Are you sure you want to restore original subtitles? All edits and merges will be lost.'),
        div({ class: 'custom-modal-actions' },
          button({
            class: 'btn btn-cancel',
            onclick: () => {
              mainState.showResetModal = false;
            }
          }, 'Cancel'),
          button({
            class: 'btn btn-danger',
            onclick: () => {
              mainState.showResetModal = false;
              chrome.tabs.sendMessage(mainState.activeTabId, { type: 'clearSubtitles', storageId }, () => {
                if (chrome.runtime.lastError) { /* ignore */ }
                location.reload();
              });
            }
          }, 'Yes, Reset All')
        )
      )
    ) : ''
  )
};