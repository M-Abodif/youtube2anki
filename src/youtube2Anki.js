// @ts-nocheck
let sidebarContainer = null;
let iframe = null;
let resizer = null;
let isResizing = false;
let loadedVideoId = null; // الفيديو الذي حُمّلت قائمته في الشريط الجانبي

function toggleSidebar() {
  if (sidebarContainer) {
    const willShow = sidebarContainer.style.display === "none";
    sidebarContainer.style.display = willShow ? "flex" : "none";

    // يوتيوب لا يعيد تحميل الصفحة عند الانتقال لفيديو آخر، فنعيد تحميل القائمة عند تغيّر الفيديو فقط
    const currentId = getId(window.location.href);
    if (willShow && loadedVideoId !== currentId) {
      iframe.src = iframe.src;
      loadedVideoId = currentId;
    }
  } else {
    sidebarContainer = document.createElement("div");
    sidebarContainer.style.position = "fixed";
    sidebarContainer.style.top = "0";
    sidebarContainer.style.right = "0";
    sidebarContainer.style.width = "400px";
    sidebarContainer.style.height = "100vh";
    sidebarContainer.style.zIndex = "9999999";
    sidebarContainer.style.display = "flex";
    sidebarContainer.style.boxShadow = "-5px 0 15px rgba(0,0,0,0.1)";
    sidebarContainer.style.backgroundColor = "#ffffff";

    resizer = document.createElement("div");
    resizer.style.width = "6px";
    resizer.style.cursor = "ew-resize";
    resizer.style.backgroundColor = "#e0e0e0";
    resizer.style.zIndex = "10";
    resizer.style.transition = "background-color 0.2s";

    resizer.onmouseover = () => { if (!isResizing) resizer.style.backgroundColor = "#ff4757"; };
    resizer.onmouseout = () => { if (!isResizing) resizer.style.backgroundColor = "#e0e0e0"; };

    iframe = document.createElement("iframe");
    iframe.src = chrome.runtime.getURL("popup/popup.html");
    iframe.style.flex = "1";
    iframe.style.border = "none";
    iframe.style.height = "100vh";
    iframe.style.overflow = "hidden";
    iframe.style.boxSizing = "border-box";

    loadedVideoId = getId(window.location.href);

    sidebarContainer.appendChild(resizer);
    sidebarContainer.appendChild(iframe);
    document.body.appendChild(sidebarContainer);

    resizer.addEventListener('mousedown', () => {
      isResizing = true;
      resizer.style.backgroundColor = "#ff4757";
      document.body.style.userSelect = 'none';
      iframe.style.pointerEvents = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      let newWidth = window.innerWidth - e.clientX;
      if (newWidth < 300) newWidth = 300;
      if (newWidth > 800) newWidth = 800;
      sidebarContainer.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        resizer.style.backgroundColor = "#e0e0e0";
        document.body.style.userSelect = 'auto';
        iframe.style.pointerEvents = 'auto';
      }
    });
  }
}

const toSeconds = (time) => {
  if (!time) return 0;
  const parts = time.split(':').map(Number);
  if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }
  return (parts[0] * 60) + parts[1];
}

// خلية CSV: نهرّب علامة " بمضاعفتها، والقيم الفارغة تصبح "" بدل "null"
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

const toCSV = (subtitles) =>
  subtitles.map(row => Object.values(row).map(csvCell).join(',')).join('\r\n') + '\r\n'

// Blob بدل data: URI حتى لا يفشل التنزيل مع الملفات الكبيرة
const download = (filename, text) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// الكشف الذكي المرن لعناصر الترجمة
const getCues = () => {
  const selectors = [
    {
      cue: 'ytd-transcript-segment-renderer',
      timestamp: '.segment-timestamp, [class*="timestamp" i]',
      text: '.segment-text, yt-formatted-string, [class*="text" i]'
    },
    {
      cue: 'transcript-segment-view-model',
      timestamp: '[class*="timestamp" i], .segment-timestamp',
      text: 'yt-attributed-string, .segment-text, [class*="text" i]'
    },
    {
      cue: '.segment',
      timestamp: '.segment-timestamp',
      text: '.segment-text'
    }
  ];

  for (const markup of selectors) {
    const cues = [...document.querySelectorAll(markup.cue)]
      .filter(cue => {
        const timeEl = cue.querySelector(markup.timestamp);
        const textEl = cue.querySelector(markup.text);
        return timeEl && textEl && timeEl.innerText.trim() !== '';
      });

    if (cues.length > 0) {
      return { cues, markup };
    }
  }

  // نظام كشف احتياطي (Fallback) في حال غيرت يوتيوب الهيكلية تماماً
  const fallbackElements = [...document.querySelectorAll('ytd-transcript-segment-renderer, transcript-segment-view-model, .segment, [class*="transcript-segment" i]')];
  if (fallbackElements.length > 0) {
    const validCues = fallbackElements.filter(el => /\d+:\d+/.test(el.innerText));
    if (validCues.length > 0) {
      return { cues: validCues, markup: { isFallback: true } };
    }
  }

  return { cues: [], markup: null };
}

// يوتيوب يضيف نصاً مخفياً لقارئات الشاشة قبل كل سطر، مثل "0 seconds" أو "1 minute, 5 seconds".
// نحذفه فقط إذا طابق وقت هذا السطر بالضبط، حتى لا نمسح كلمات حقيقية من الكلام.
const stripA11yTime = (text, startSeconds) => {
  const m = text.match(/^\s*(?:(\d+)\s+hours?,?\s*)?(?:(\d+)\s+minutes?,?\s*)?(?:(\d+)\s+seconds?)?\s*/i)
  if (!m || !m[0].trim()) return text
  const total = (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0)
  return total === startSeconds ? text.slice(m[0].length) : text
}

const getSubtitles = (cues, markup, title) => {
  const id = getId(window.location.href)

  const getCueTime = (cue) => {
    if (!cue) return null;
    if (markup?.isFallback) {
      const match = cue.innerText.match(/\b\d+:\d+(?::\d+)?\b/);
      return match ? match[0] : null;
    }
    return cue.querySelector(markup.timestamp)?.innerText.trim() || null;
  };

  const getCueText = (cue) => {
    if (!cue) return null;
    const time = getCueTime(cue);
    let text;
    if (markup?.isFallback) {
      text = time ? cue.innerText.replace(time, '') : cue.innerText;
    } else {
      text = cue.querySelector(markup.text)?.innerText || '';
    }
    return stripA11yTime(text.trim(), toSeconds(time)) || null;
  };

  return cues.map((cue, i) => {
    const time = getCueTime(cue) || "0:00";
    const nextTime = getCueTime(cues[i + 1]);
    const text = getCueText(cue) || "";
    const prevText = getCueText(cues[i - 1]);
    const nextText = getCueText(cues[i + 1]);
    const endSeconds = nextTime ? toSeconds(nextTime) + 1 : null;
    const hash = (Math.random() + 1).toString(36).substring(2);

    return {
      time,
      nextTime: nextTime || time,
      text,
      prevText,
      nextText,
      id,
      startSeconds: toSeconds(time),
      endSeconds,
      title,
      hash
    }
  })
}

const getId = (url) => {
  const match = url.match(/^.*(youtu.be\/|v\/|e\/|u\/\w+\/|embed\/|v=)(?<id>[^#&?]*).*/)
  return match?.groups?.id
}

// الفيديو الرئيسي للمشغّل (وليس أي <video> آخر في الصفحة مثل معاينات الصور المتحركة)
const getMainVideo = () =>
  document.querySelector('#movie_player video.html5-main-video') ||
  document.querySelector('video.html5-main-video') ||
  document.querySelector('#movie_player video') ||
  document.querySelector('video')

// أثناء الإعلان يكون <video> هو فيديو الإعلان، وأي قفز في الزمن يضيع عند عودة الفيديو الأصلي
const isAdShowing = () => !!document.querySelector('.html5-video-player.ad-showing, #movie_player.ad-showing')

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, action } = request;
  const msgType = type || action;

  try {
    if (msgType === 'toggleSidebar') {
      toggleSidebar();
      sendResponse({ status: "toggled" });
      return true;
    }

    if (msgType === 'pauseVideo') {
      const video = getMainVideo();
      if (video && !video.paused) {
        video.pause();
      }
      sendResponse({ status: "paused" });
      return true;
    }

    if (msgType === 'seekTo') {
      const video = getMainVideo()
      const requested = Number(request.timeSeconds)

      if (isAdShowing()) {
        console.log('[Youtube2Anki] seekTo ignored because an ad is playing', { requested })
        sendResponse({ status: "ad" });
        return true;
      }

      if (video && Number.isFinite(requested)) {
        video.currentTime = requested
        video.play()?.catch?.(() => {})
      }
      // سجل تشخيصي (F12 > Console في صفحة يوتيوب): الوقت المطلوب، ووقت الفيديو بعد القفز، وعدد عناصر video في الصفحة
      console.log('[Youtube2Anki] seekTo', { requested, now: video?.currentTime, videos: document.querySelectorAll('video').length })
      sendResponse({ status: "seeked" });
      return true;
    }

    if (msgType === 'getCurrentTime') {
      const video = getMainVideo();
      if (video) {
        sendResponse({ currentTime: video.currentTime });
      } else {
        sendResponse({ currentTime: 0 });
      }
      return true;
    }

    if (msgType === 'storeSubtitles') {
      sessionStorage.setItem(request.storageId, JSON.stringify(request.subtitles))
      sendResponse({ status: "stored" });
      return true;
    }

    if (msgType === 'clearSubtitles') {
      sessionStorage.removeItem(request.storageId)
      sendResponse({ status: "cleared" });
      return true;
    }

    if (msgType === 'getSubtitles') {
      const storedSubtitles = JSON.parse(sessionStorage.getItem(request.storageId) || '[]')
      if (storedSubtitles.length) {
        // fromStorage: ترجمة محفوظة سابقًا (بتعديلات المستخدم) فلا يجب أن يعيد popup.js دمجها تلقائيًا
        sendResponse({ subtitles: storedSubtitles, fromStorage: true })
        return true;
      }

      const { cues, markup } = getCues()

      if (cues.length && markup) {
        const subtitles = getSubtitles(cues, markup, request.title)
        sendResponse({ subtitles })
      } else {
        sendResponse({ subtitles: null })
      }
      return true;
    }

    if (msgType === 'download') {
      const { title, subtitles } = request
      // originalText حقل داخلي للتراجع (Undo) ولا يجب أن يظهر كعمود في الـ CSV
      const cleanSubtitles = subtitles.map(({ disabled, mergedFrom, originalText, ...rest }) => rest)
      const csv = toCSV(cleanSubtitles)
      download(`${title}.csv`, csv)
      sendResponse({ status: "downloaded" });
      return true;
    }
  } catch (error) {
    console.error("YouTube2Anki Error:", error);
    sendResponse({ error: error.message, subtitles: null });
    return true;
  }

  // رسالة غير معروفة: لا نُبقي القناة مفتوحة بلا ردّ
  return false;
});