// @ts-nocheck

// يطابق youtube.com و www و m و music ... (والـ manifest يحقن الـ content script في *.youtube.com)
const YOUTUBE_URL = /^https?:\/\/([\w-]+\.)*youtube\.com(\/|$)/

const enableDisableTab = (id, url) => {
  if (YOUTUBE_URL.test(url)) {
    chrome.action.enable(id)
  } else {
    chrome.action.disable(id)
  }
}

chrome.tabs.onActivated.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const [activeTab] = tabs
    if (activeTab) {
      const { url, id } = activeTab
      id && url && enableDisableTab(id, url)
    }
  })
})

chrome.tabs.onUpdated.addListener((id, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    id && tab?.url && enableDisableTab(id, tab.url)
  }
})

// إرسال الرسالة بالتوافق مع كلا المسمّيين (type و action)
chrome.action.onClicked.addListener((tab) => {
  if (tab.id && tab.url && YOUTUBE_URL.test(tab.url)) {
    chrome.tabs.sendMessage(tab.id, { type: 'toggleSidebar', action: 'toggleSidebar' }).catch(() => {
      // الـ content script غير محمّل: التبويب كان مفتوحًا قبل تثبيت/تحديث الإضافة.
      // console.log داخل الـ service worker لا يراه أحد، فنعرض إشعارًا واضحًا
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'YouTube2Anki',
        message: 'Refresh this YouTube tab (F5), then open the sidebar again.'
      })
    })
  }
})