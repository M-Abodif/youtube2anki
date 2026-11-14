// @ts-nocheck
import { elementFactory, render as renderNode } from './skruv-0.7.7/skruv.js'
import { cssTextGenerator } from './skruv-0.7.7/utils/css.js'
const { body } = elementFactory

import { state as mainState } from './state.js'

import { About } from './components/About.js'
import { Export } from './components/Export.js'
import { List } from './components/List.js'
import { Instructions } from './components/Instructions.js'
import { Loading } from './components/Loading.js'
import { getId, toPlainSubtitles } from './utils.js'
import { autoMergeByPunctuation } from './autoMerge.js'

/**
 * @param {chrome.tabs.Tab} tab
 */
const getTabInfo = (tab) => {
  const { id, url, title } = tab

  const youTubeId = getId(String(url))
  const storageId = `youTube2AnkiSubtitles-${youTubeId}`
  // نحذف "- YouTube" ورقم الإشعارات في بداية العنوان مثل "(3) " حتى لا يدخل في اسم الدِك
  const formattedTitle = String(title).replace('- YouTube', '').replace(/^\(\d+\)\s*/, '').trim() || 'Untitled'
  return { id, title: formattedTitle, storageId }
}

/**
 * Keeps the styles registered with the skruv css helper in the document
 */
const injectStyles = async () => {
  const styleNode = document.head.appendChild(document.createElement('style'))
  for await (const cssText of cssTextGenerator()) {
    styleNode.textContent = cssText
  }
}

document.addEventListener('DOMContentLoaded', () => {
  (async () => {
    injectStyles()

    // @ts-expect-error Skruv initialization
    for await (const stateItem of mainState) {
      chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
        if (!tabs?.[0]) return
        const { id, storageId, title } = getTabInfo(tabs[0])

        // Store subtitles on changes of state
        const stateSubtitles = toPlainSubtitles(stateItem?.subtitles)
        if (id && storageId && Boolean(stateSubtitles.length)) {
          chrome.tabs.sendMessage(id, { type: 'storeSubtitles', storageId, subtitles: stateSubtitles }, () => {
            void chrome.runtime.lastError
          })
        }

        renderNode(
          body({
            skruvAfterCreate: () => {
              // Connect to the page script and request the subtitles
              mainState.title = title

              if (id) {
                mainState.activeTabId = id
                chrome.tabs.sendMessage(id, { type: 'getSubtitles', title, storageId }, (response) => {
                  void chrome.runtime.lastError // الـ content script غير محمّل: نعرض صفحة التعليمات
                  const { subtitles, fromStorage } = response || {}

                  if (subtitles?.length) {
                    // الدمج التلقائي (نفس دالة زر Auto-merge في autoMerge.js) للترجمة الجديدة فقط. المحفوظة سابقًا (بتعديلاتك) تُعرض كما هي
                    mainState.subtitles = fromStorage ? subtitles : autoMergeByPunctuation(subtitles)
                    mainState.view = 'list'
                  } else {
                    mainState.view = 'instructions'
                  }
                })
              }
            }
          },
            // Views of the extension
            [
              mainState.view === 'loading' && Loading(),
              mainState.view === 'list' && List(storageId),
              mainState.view === 'export' && Export(),
              mainState.view === 'instructions' && Instructions(),
              About()
            ].filter(Boolean)
          ),
          // @ts-expect-error Skruv ships its own DOM typings
          document.body
        )
      })
    }
  })()
})