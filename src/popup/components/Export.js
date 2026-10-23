import { elementFactory } from '../skruv-0.7.7/skruv.js'
import { state as mainState } from '../state.js'
import { ExportAnki } from './ExportAnki.js'
import { getEnabledSubtitles, toPlainSubtitles } from '../utils.js'
import { css } from '../skruv-0.7.7/utils/css.js'

const { div, h2, button, p } = elementFactory

// التصميم الفاتح لصفحة التصدير
const styling = css`
  :scope {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    background-color: #ffffff; /* أبيض */
    color: #333333;
    overflow-x: hidden;
    overflow-y: auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    box-sizing: border-box;
  }

  .header-back {
    position: sticky;
    top: 0;
    background-color: #f8f9fa;
    padding: 15px;
    border-bottom: 1px solid #e0e0e0;
    z-index: 10;
    display: flex;
    justify-content: flex-start;
  }

  .btn {
    background-color: transparent;
    border: 1px solid #dcdde1;
    color: #353b48;
    padding: 8px 16px;
    border-radius: 15px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
  }
  
  .btn:hover { background-color: #f1f2f6; }

  .content-area {
    padding: 20px 15px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .card {
    background-color: #f8f9fa;
    padding: 20px;
    border-radius: 12px;
    border: 1px solid #dcdde1;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  h2 { margin: 0; font-size: 1.2rem; color: #ff4757; }
  p { margin: 0; font-size: 0.95rem; line-height: 1.5; color: #353b48; }
  
  .btn-download {
    background-color: #ff4757;
    color: #ffffff;
    font-weight: bold;
    border: none;
    align-self: flex-start;
    border-radius: 8px;
  }
  
  .btn-download:hover { background-color: #ff6b81; }
`

export const Export = () => div(
  { class: styling },
  div({ class: 'header-back' },
    button({ 
      class: 'btn', 
      onclick: () => { mainState.view = 'list' } 
    }, '← ' + (chrome.i18n.getMessage('exportEditCards') || 'Back to List'))
  ),
  div({ class: 'content-area' },
    ExportAnki(),
    div({ class: 'card' },
      h2({}, chrome.i18n.getMessage('exportExportTitle') || 'Export as Text File'),
      p({}, chrome.i18n.getMessage('exportExportDescription') || 'Download a plain text file containing all selected cards.'),
      button({
        class: 'btn btn-download',
        onclick: () => {
          chrome.tabs.sendMessage(mainState.activeTabId, {
            type: 'download',
            title: mainState.title,
            subtitles: getEnabledSubtitles(toPlainSubtitles(mainState.subtitles))
          })
        }
      }, chrome.i18n.getMessage('exportExportDownload') || 'Download File')
    )
  )
)