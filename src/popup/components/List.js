import { elementFactory } from '../skruv-0.7.7/skruv.js'
import { state as mainState } from '../state.js'
import { getEnabledSubtitles } from '../utils.js'
import { autoMergeByPunctuation } from '../autoMerge.js'

const { div, span, ul, li, button, h2, h3, p, input } = elementFactory
import { css } from '../skruv-0.7.7/utils/css.js'

let lastCheckedIndex = null;

// التعديل الجديد: دالة لإرسال أمر إيقاف الفيديو
const pauseYouTubeVideo = () => {
  chrome.tabs.sendMessage(mainState.activeTabId, { type: 'pauseVideo' }, () => {
    if (chrome.runtime.lastError) { /* تجاهل الخطأ في حال لم يتم تحميل content.js بعد */ }
  });
};

const getCardsToMerge = () => {
  if (isNaN(mainState.mergeStart) || isNaN(mainState.mergeEnd)) return []
  if (mainState.mergeStart <= mainState.mergeEnd) {
    return mainState.subtitles.slice(mainState.mergeStart, mainState.mergeEnd + 1).map(v => ({ ...v }))
  }
  return mainState.subtitles.slice(mainState.mergeEnd, mainState.mergeStart + 1).map(v => ({ ...v }))
}

const mergeCards = (cardsToMerge) => {
  const lastCard = cardsToMerge[cardsToMerge.length - 1]
  const card = {
    ...cardsToMerge[0],
    text: cardsToMerge.map(({ text }) => text).join(' '),
    endSeconds: lastCard.endSeconds,
    nextTime: lastCard.nextTime,
    nextText: lastCard.nextText,
    mergedFrom: cardsToMerge
  }

  if (mainState.mergeStart < mainState.mergeEnd) {
    mainState.subtitles = [
      ...mainState.subtitles.slice(0, mainState.mergeStart),
      card,
      ...mainState.subtitles.slice(mainState.mergeEnd + 1, mainState.subtitles.length)
    ];
    document.querySelector(`[data-index="${mainState.mergeStart}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } else {
    mainState.subtitles = [
      ...mainState.subtitles.slice(0, mainState.mergeEnd),
      card,
      ...mainState.subtitles.slice(mainState.mergeStart + 1, mainState.subtitles.length)
    ];
    document.querySelector(`[data-index="${mainState.mergeEnd}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  mainState.mergeStart = NaN
  mainState.mergeEnd = NaN
}

const unmergeCard = (index) => {
  const mergedFrom = mainState.subtitles[index].mergedFrom
  if (!mergedFrom?.length) return
  mainState.subtitles = [
    ...mainState.subtitles.slice(0, index),
    ...mergedFrom.map(v => ({ ...v })),
    ...mainState.subtitles.slice(index + 1, mainState.subtitles.length)
  ]
  mainState.mergeStart = NaN
  mainState.mergeEnd = NaN
}

const autoMergeCards = () => {
  mainState.subtitles = autoMergeByPunctuation(mainState.subtitles)
  mainState.mergeStart = NaN
  mainState.mergeEnd = NaN
}

const styling = css`
  :scope {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    background-color: #ffffff !important;
    color: #333333 !important;
    overflow-x: hidden;
  }

  * { box-sizing: border-box; }

  .header-container {
    background-color: #f8f9fa;
    padding: 12px 15px;
    border-bottom: 1px solid #e0e0e0;
    flex-shrink: 0;
    z-index: 20;
    width: 100%;
  }

  .header-container h2 {
    margin: 0 0 10px 0;
    font-size: 1rem;
    font-weight: 600;
    text-align: center;
    color: #ff4757;
  }

  .action-buttons {
    display: flex;
    gap: 6px;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 10px;
    width: 100%;
  }

  .btn {
    background-color: transparent;
    border: 1px solid #dcdde1;
    color: #353b48;
    padding: 6px 12px;
    border-radius: 15px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn:hover:not(:disabled) {
    background-color: #f1f2f6;
    border-color: #a4b0be;
  }
  
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-danger { background-color: #ff4757; color: white; border: none; }
  .btn-danger:hover:not(:disabled) { background-color: #ff6b81; }

  .jump-controls {
    display: flex;
    gap: 8px;
    width: 100%;
  }

  .jump-input {
    flex: 1;
    min-width: 0;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid #dcdde1;
    background-color: #ffffff;
    color: #333333;
    font-size: 0.85rem;
    outline: none;
    transition: border-color 0.2s;
  }
  .jump-input:focus { border-color: #ff4757; }

  .jump-btn {
    flex-shrink: 0;
    background-color: transparent;
    border: 1px solid #ff4757;
    color: #ff4757;
    padding: 6px 12px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    font-size: 0.85rem;
    transition: all 0.2s;
  }
  .jump-btn:hover { background-color: rgba(255, 71, 87, 0.1); }
  
  .jump-btn-sync {
    background-color: #ff4757;
    color: white;
    border: none;
  }
  .jump-btn-sync:hover { background-color: #ff6b81; }

  ul {
    list-style-type: none;
    margin: 0;
    padding: 10px 0;
    overflow-x: hidden;
    overflow-y: auto;
    width: 100%;
    flex: 1;
    background-color: #ffffff;
  }

  ul::-webkit-scrollbar { width: 6px; }
  ul::-webkit-scrollbar-track { background: transparent; }
  ul::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.2); border-radius: 4px; }
  ul::-webkit-scrollbar-thumb:hover { background-color: rgba(0,0,0,0.4); }
  
  li {
    position: relative;
    border-bottom: 1px solid #f1f2f6;
    width: 100%;
    transition: background-color 0.3s ease;
  }

  .highlight-sync { background-color: rgba(255, 71, 87, 0.15) !important; }

  .listButton {
    width: 100%;
    display: flex;
    align-items: flex-start;
    cursor: pointer;
    margin: 0;
    padding: 12px 15px;
    border: none;
    background-color: transparent;
    color: #333333;
    text-align: left;
    outline: none;
    transition: background-color 0.2s;
  }

  .listButton:hover, .listButton:focus { background-color: #f8f9fa; }
  .disabled { opacity: 0.65; text-decoration: line-through; color: #718093; }

  .toggle-checkbox {
    width: 18px;
    height: 18px;
    min-width: 18px;
    flex-shrink: 0;
    border: 2px solid #ced6e0;
    border-radius: 4px;
    margin-right: 12px;
    margin-top: 2px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .listButton:not(.disabled) .toggle-checkbox { background-color: #ff4757; border-color: #ff4757; }
  .listButton:not(.disabled) .toggle-checkbox::after { content: '✓'; color: white; font-size: 12px; font-weight: bold; }

  .time-stamp {
    font-size: 0.8rem;
    color: var(--action-color);
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    gap: 2px;
    padding: 4px 6px;
    border-radius: 6px;
    background: rgba(255, 71, 87, 0.05);
    border: 1px solid rgba(255, 71, 87, 0.1);
    white-space: nowrap;
    margin-right: 12px;
    margin-top: 2px;
    transition: background-color 0.2s;
  }
  
  .time-stamp:hover { background: rgba(255, 71, 87, 0.15); }

  .time-end {
    font-size: 0.65rem;
    color: #718093;
    font-weight: 500;
  }

  .text-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .text {
    font-size: 0.95rem;
    line-height: 1.5; 
    outline: none;
    color: inherit;
    white-space: normal;
    word-break: break-word;
    overflow-wrap: break-word;
    width: 100%;
    padding: 2px 4px;
    border-radius: 4px;
    border: 1px solid transparent;
    transition: background-color 0.2s, border-color 0.2s;
  }

  .text[contenteditable="true"]:hover { border-color: #dcdde1; background-color: #f1f2f6; cursor: text; }
  .text[contenteditable="true"]:focus { border-color: #ff4757; background: #ffffff; }

  .card-actions {
    display: flex; 
    gap: 8px; 
    padding: 0 15px 12px 45px;
    flex-wrap: wrap;
    background-color: transparent;
  }

  .card-actions { display: none; }
  li:hover .card-actions, li:focus-within .card-actions { display: flex; }

  .card-actions .btn { font-size: 0.75rem; padding: 4px 10px; flex-shrink: 0; border-radius: 12px; }
  .card-actions .hidden { display: none !important; }
  .inRange { background-color: rgba(255, 71, 87, 0.05) !important; }

  .export-container {
    background-color: #ffffff;
    padding: 15px;
    border-top: 1px solid #e0e0e0;
    flex-shrink: 0;
    width: 100%;
  }

  .btn-export {
    background-color: #2ed573; 
    color: #ffffff;
    border: none;
    padding: 12px;
    width: 100%; 
    font-weight: bold;
    font-size: 1.05rem;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 4px 6px rgba(46, 213, 115, 0.2);
    transition: all 0.2s ease;
  }
  .btn-export:hover:not(:disabled) { background-color: #26b360; transform: translateY(-2px); }
  .btn-export:disabled { background-color: #ced6e0; box-shadow: none; cursor: not-allowed; }

  .custom-modal-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(2px);
    display: flex; justify-content: center; align-items: center;
    z-index: 9999;
  }
  .custom-modal {
    background: #ffffff; padding: 25px; border-radius: 12px;
    text-align: center; border: 1px solid #dcdde1; width: 85%;
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  }
  .custom-modal h3 { color: #ff4757; margin-top: 0; }
  .custom-modal p { color: #353b48; margin-bottom: 25px; font-size: 0.95rem; }
  .custom-modal-actions { display: flex; gap: 10px; justify-content: center; }
`

const toggleItem = (e, index) => {
  const targetState = !mainState.subtitles[index].disabled;
  if (e && e.shiftKey && lastCheckedIndex !== null) {
    const start = Math.min(lastCheckedIndex, index);
    const end = Math.max(lastCheckedIndex, index);
    for (let i = start; i <= end; i++) {
      mainState.subtitles[i].disabled = targetState;
    }
  } else {
    mainState.subtitles[index].disabled = targetState;
  }
  lastCheckedIndex = index;
}

const setAll = (state) => {
  mainState.subtitles.forEach(item => { item.disabled = state })
}

export const List = (storageId) => {
  const enabledCards = getEnabledSubtitles(mainState.subtitles).length
  const cardsToMerge = getCardsToMerge()
  const canAutoMerge = autoMergeByPunctuation(mainState.subtitles).length < mainState.subtitles.length

  return div(
    { class: `card ${styling}` },
    
    div({ class: 'header-container' },
      h2({}, chrome.i18n.getMessage('listSelect') || 'Select'),
      
      div({ class: 'action-buttons' },
        button({
          disabled: enabledCards === mainState.subtitles.length || undefined,
          class: 'btn',
          onclick: () => setAll(false)
        }, chrome.i18n.getMessage('listSelectAll') || 'All'),
        
        button({
          class: 'btn',
          disabled: enabledCards === 0 || undefined,
          onclick: () => setAll(true)
        }, chrome.i18n.getMessage('listSelectNone') || 'None'),

        button({
          class: 'btn btn-danger',
          title: 'Restore all original subtitles',
          onclick: () => { mainState.showResetModal = true; }
        }, 'Reset All'),

        button({
          class: 'btn',
          title: chrome.i18n.getMessage('listAutoMergeTitle'),
          disabled: !canAutoMerge || undefined,
          onclick: autoMergeCards
        }, chrome.i18n.getMessage('listAutoMerge') || 'Auto-merge')
      ),

      div({ class: 'jump-controls' },
        input({
          id: 'jump-time-input',
          class: 'jump-input',
          type: 'text',
          placeholder: 'e.g., 7 or 15:30',
          onkeydown: (e) => {
            if (e.key === 'Enter') document.getElementById('jump-btn-action').click();
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
              const timeSpan = li.querySelector('.time-stamp');
              if (timeSpan && timeSpan.innerText.includes(timeValue)) {
                li.scrollIntoView({ behavior: 'smooth', block: 'center' });
                li.classList.add('highlight-sync');
                setTimeout(() => { li.classList.remove('highlight-sync'); }, 2000);
                break;
              }
            }
          }
        }, 'Jump'),
        button({
          class: 'jump-btn jump-btn-sync',
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
                    targetLi.classList.add('highlight-sync');
                    setTimeout(() => { targetLi.classList.remove('highlight-sync'); }, 2000);
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
        return li({ class: `${item.disabled ? 'disabled' : ''}${isInRange ? ' inRange' : ''}` },
          button({
            onmouseover: (event) => {
              event.currentTarget.focus()
              if (!isNaN(mainState.mergeStart)) mainState.mergeEnd = i
            },
            onfocus: () => { if (!isNaN(mainState.mergeStart)) mainState.mergeEnd = i },
            onkeydown: (e) => {
              if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); toggleItem(e, i); }
            },
            'data-index': i,
            class: 'listButton',
            onclick: (e) => toggleItem(e, i)
          },
            span({ class: 'toggle-checkbox' }),
            span({
              class: 'time-stamp',
              title: 'Play video from this moment',
              onclick: (e) => {
                e.stopPropagation(); 
                const timeParts = item.time.split(':').map(Number);
                const seconds = timeParts.length === 2
                  ? timeParts[0] * 60 + timeParts[1]
                  : timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
                chrome.tabs.sendMessage(mainState.activeTabId, { type: 'seekTo', timeSeconds: seconds }, () => {
                  if (chrome.runtime.lastError) {}
                });
              }
            }, 
              span({}, `▶ ${item.time}`),
              item.nextTime ? span({ class: 'time-end' }, item.nextTime) : ''
            ),
            
            div({ class: 'text-content' },
              span({
                class: 'text',
                contenteditable: 'true',
                onclick: (e) => e.stopPropagation(),
                // التعديل الجديد: إيقاف الفيديو عند التركيز على النص للتعديل
                onfocus: () => pauseYouTubeVideo(),
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
                  if (e.key === 'Enter') { e.preventDefault(); target.blur(); } 
                  else if (e.key === 'Escape') { e.preventDefault(); target.innerText = item.text; target.blur(); }
                }
              }, item.text),
              (item.originalText !== undefined && item.originalText !== item.text) ? button({
                class: 'btn btn-danger',
                style: 'margin-top: 5px; align-self: flex-start; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem;',
                onclick: (e) => {
                  e.stopPropagation();
                  mainState.subtitles[i].text = item.originalText;
                  mainState.subtitles[i].originalText = undefined;
                }
              }, '↩️ Undo') : ''
            )
          ),

          div({ class: 'card-actions' },
            button({
              class: 'btn',
              style: 'background-color: transparent; border: 1px solid #dcdde1; color: #353b48;',
              onclick: (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(item.text);
                const btn = e.currentTarget;
                const originalText = btn.innerText;
                btn.innerText = 'Copied! ✓';
                btn.style.color = '#2ed573';
                btn.style.borderColor = '#2ed573';
                setTimeout(() => {
                  btn.innerText = originalText;
                  btn.style.color = '#353b48';
                  btn.style.borderColor = '#dcdde1';
                }, 1500);
              }
            }, '📋 Copy'),
            
            button({
              class: 'btn',
              onclick: () => {
                // التعديل الجديد: إيقاف الفيديو عند بدء عملية الدمج
                pauseYouTubeVideo();
                if (isNaN(mainState.mergeStart)) mainState.mergeStart = i
                else { mainState.mergeStart = NaN; mainState.mergeEnd = NaN }
              }
            }, isNaN(mainState.mergeStart) ? '🔗 Merge' : '❌ Cancel'),

            button({
              class: `btn btn-danger${cardsToMerge.length > 1 ? '' : ' hidden'}`,
              onclick: () => mergeCards(getCardsToMerge())
            }, `Confirm Merge (${cardsToMerge.length})`),

            button({
              class: `btn${item.mergedFrom?.length && cardsToMerge.length <= 1 ? '' : ' hidden'}`,
              onclick: () => unmergeCard(i)
            }, '✂️ Unmerge')
          )
        )
      })
    ),

    div({ class: 'export-container' },
      button(
        {
          class: 'btn-export',
          disabled: enabledCards === 0 || undefined,
          onclick: () => { if (enabledCards > 0) mainState.view = 'export' }
        },
        enabledCards > 0 ? (chrome.i18n.getMessage('listExportCards', String(enabledCards)) || `Export ${enabledCards} Cards`) : 'No Cards Selected'
      )
    ),

    mainState.showResetModal ? div({ class: 'custom-modal-overlay' },
      div({ class: 'custom-modal' },
        h3({}, '⚠️ Confirm Reset'),
        p({}, 'Are you sure you want to restore original subtitles?'),
        div({ class: 'custom-modal-actions' },
          button({ class: 'btn', onclick: () => { mainState.showResetModal = false; } }, 'Cancel'),
          button({
            class: 'btn btn-danger',
            onclick: () => {
              mainState.showResetModal = false;
              chrome.tabs.sendMessage(mainState.activeTabId, { type: 'clearSubtitles', storageId }, () => {
                if (chrome.runtime.lastError) {}
                location.reload();
              });
            }
          }, 'Yes, Reset')
        )
      )
    ) : ''
  )
};