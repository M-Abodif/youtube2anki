import { elementFactory } from '../skruv-0.7.7/skruv.js'
import { state as mainState } from '../state.js'
import { sendNotification, getEnabledSubtitles } from '../utils.js'

const { div, h2, button, p, a, datalist, form, input, option, br, label, textarea } = elementFactory

const scheme = 'http'
const host = 'localhost'
const port = 8765
const MODEL_NAME = 'Youtube2AnkiV2'

// التعديل: السماح بـ allowDuplicate (حسب تفضيلك، ولكن الأفضل تركها false ومعالجة الخطأ)
const getNote = (subtitle, deck, model, explanation) => (
  {
    deckName: deck,
    modelName: model,
    fields: {
      time: subtitle.time,
      nextTime: subtitle.nextTime || '',
      text: subtitle.text,
      prevText: subtitle.prevText || '',
      nextText: subtitle.nextText || '',
      id: subtitle.id,
      startSeconds: (subtitle.startSeconds && subtitle.startSeconds.toString()) || '',
      endSeconds: (subtitle.endSeconds && subtitle.endSeconds.toString()) || '',
      title: subtitle.title,
      hash: subtitle.hash,
      Explanation: explanation
    },
    tags: [],
    options: {
      // إبقاء false لأننا لا نريد كروت مكررة فعلياً
      allowDuplicate: false 
    }
  }
)

const initDecks = async (title) => {
  try {
    const { result: decks } = await (await fetch(`${scheme}://${host}:${port}`,
      {
        method: 'POST',
        body: JSON.stringify({ action: 'deckNames', version: 6 })
      }
    )).json()

    if (!decks.includes(title)) { decks.push(title) }
    mainState.deckNames = decks.filter(Boolean)
  } catch (error) {
    console.warn(error)
    mainState.error = { message: chrome.i18n.getMessage('exportSendToAnkiError') || 'Cannot connect to Anki.' }
  }
}

const createDeck = async (deckName) => {
  const createDeckResponse = await fetch(`${scheme}://${host}:${port}`,
    {
      method: 'POST',
      body: JSON.stringify({ action: 'createDeck', version: 6, params: { deck: deckName } })
    }
  )
  const { err } = await createDeckResponse.json()
  if (err) throw new Error(err)
}

const createModel = async () => {
  const createModelResponse = await fetch(`${scheme}://${host}:${port}`,
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'createModel',
        version: 6,
        params: {
          modelName: MODEL_NAME,
          inOrderFields: ['time', 'nextTime', 'text', 'prevText', 'nextText', 'id', 'startSeconds', 'endSeconds', 'title', 'hash', 'Explanation'],
          css: `.card { font-family: sans-serif; font-size: 20px; text-align: center; color: black; background-color: #e9e9e9; } span { font-size: 0.9rem; color: #3c3c3c; }`,
          cardTemplates: [
            {
              Front: `{{title}}<br><span>{{prevText}}</span><br>{{text}}<br><iframe width="560" height="315" src="https://www.youtube.com/embed/{{id}}?start={{startSeconds}}&end={{endSeconds}}&autoplay=1" frameborder=0 autoplay=1></iframe><br><span>{{time}} - {{nextTime}}</span><br><span>{{nextText}}</span>`,
              Back: `{{FrontSide}}<hr id=answer>{{Explanation}}`
            }
          ]
        }
      })
    }
  )
  const { errorCreateModel } = await createModelResponse.json()
  if (errorCreateModel) throw new Error(errorCreateModel)
}

const ensureExplanationField = async () => {
  const fieldNamesResponse = await fetch(`${scheme}://${host}:${port}`,
    {
      method: 'POST',
      body: JSON.stringify({ action: 'modelFieldNames', version: 6, params: { modelName: MODEL_NAME } })
    }
  )
  const { result: fieldNames, error: fieldNamesError } = await fieldNamesResponse.json()
  if (fieldNamesError) throw new Error(fieldNamesError)
  if (fieldNames.includes('Explanation')) return

  const addFieldResponse = await fetch(`${scheme}://${host}:${port}`,
    {
      method: 'POST',
      body: JSON.stringify({ action: 'modelFieldAdd', version: 6, params: { modelName: MODEL_NAME, fieldName: 'Explanation' } })
    }
  )
  const { error: addFieldError } = await addFieldResponse.json()
  if (addFieldError) throw new Error(addFieldError)
}

// التعديل الرئيسي لحل مشكلة التكرار
const openAddCardsWindows = async (subtitles, deckName, explanation) => {
  const notes = subtitles.map(subtitle => getNote(subtitle, deckName, MODEL_NAME, explanation))

  // نستخدم canAddNotes للتحقق من الكروت قبل إرسالها (اختياري للتحسين)
  // أو نقوم بتمرير العملية وتجاهل الأخطاء الناتجة عن التكرار فقط
  const addNotesResponse = await fetch(`${scheme}://${host}:${port}`,
    {
      method: 'POST',
      body: JSON.stringify({ action: 'addNotes', version: 6, params: { notes: notes } })
    }
  )
  
  const response = await addNotesResponse.json()
  
  // إذا كان هناك خطأ، نتحقق مما إذا كان بسبب التكرار
  if (response.error) {
    if (response.error.includes("duplicate")) {
      // نرمي خطأ مخصص يسهل قراءته للمستخدم
      throw new Error("Some or all cards are already in Anki (Duplicates). Only new cards were added.");
    } else {
      throw new Error(response.error);
    }
  }
  
  return response.result; // يعود بمصفوفة من الـ IDs للكروت الناجحة أو null للمكررة
}

export const ExportAnki = () => div(
  {
    style: 'display: flex; flex-direction: column; gap: 15px;',
    skruvAfterCreate: async () => { await initDecks(mainState.title) }
  },
  h2({ style: 'margin:0; font-size:1.1rem; color:#353b48;' }, chrome.i18n.getMessage('exportSendToAnkiTitle') || 'Send to Anki'),
  p({ style: 'margin:0; font-size:0.9rem; color:#718093; line-height:1.4;' },
    chrome.i18n.getMessage('exportSendToAnkiDescription1') || 'Use ',
    a({ href: 'https://ankiweb.net/shared/info/2055492159', target: '_blank', style: 'color:#ff4757; text-decoration:none;' }, 'Anki Connect'),
    chrome.i18n.getMessage('exportSendToAnkiDescription2') || ' to add cards directly to a deck.'
  ),
  
  !!mainState.error?.message && p({ style: 'color:#ff4757; font-weight:bold; font-size:0.9rem;' }, mainState.error.message),
  !!mainState.error?.message && button({
    style: 'padding:8px; border:1px solid #ced6e0; border-radius:6px; background:#fff; cursor:pointer;',
    onclick: async () => { mainState.error = {}; await initDecks(mainState.title) }
  }, chrome.i18n.getMessage('exportSendToAnkiReconnect') || 'Reconnect'),
  
  !!mainState.deckNames &&
  form(
    {
      style: 'display: flex; flex-direction: column; gap: 10px;',
      onsubmit: async (/** @type {Event} */e) => {
        e.preventDefault()
        const formData = new FormData(e.target)
        const deckName = /** @type {string} */(formData.get('deckName'))
        const explanation = /** @type {HTMLTextAreaElement | null} */(document.getElementById('userExplanation'))?.value ?? ''

        // تغيير نص الزر أثناء التحميل (تجربة مستخدم أفضل)
        const submitBtn = document.getElementById('anki-submit-btn');
        if (submitBtn) {
          submitBtn.innerText = 'Sending...';
          submitBtn.disabled = true;
          submitBtn.style.backgroundColor = '#a4b0be';
        }

        try {
          const subtitles = getEnabledSubtitles(mainState.subtitles)
          
          if (subtitles.length === 0) {
             throw new Error("No cards selected!");
          }

          await createDeck(deckName)
          await createModel()
          await ensureExplanationField()
          
          const result = await openAddCardsWindows(subtitles, deckName, explanation)
          
          // حساب الكروت التي تمت إضافتها بنجاح
          const addedCount = result ? result.filter(id => id !== null).length : 0;
          const duplicateCount = subtitles.length - addedCount;

          let successMessage = addedCount > 0 
            ? `${addedCount} new cards sent to Anki successfully.` 
            : `Operation finished.`;
            
          if (duplicateCount > 0) {
            successMessage += ` (${duplicateCount} duplicate cards were skipped).`;
          }

          sendNotification('Success', successMessage, () => { mainState.view = 'list'; })
          
          // العودة للقائمة فوراً بعد الإرسال الناجح
          mainState.view = 'list';
          
        } catch (error) {
          console.error(error)
          
          // إذا كان الخطأ بسبب التكرار (Duplicates) نعتبرها عملية شبه ناجحة
          if (error.message.includes("Duplicates")) {
             sendNotification('Notice', error.message, () => { mainState.view = 'list'; })
             mainState.view = 'list';
          } else {
             // أخطاء أخرى (مثل Anki مغلق)
             sendNotification(chrome.i18n.getMessage('exportSendToAnkiErrorCreating') || 'Error', error.message)
          }
          
        } finally {
          // إعادة زر الإرسال لوضعه الطبيعي
          if (submitBtn) {
            submitBtn.innerText = chrome.i18n.getMessage('exportSendToAnkiSend') || 'Send';
            submitBtn.disabled = false;
            submitBtn.style.backgroundColor = '#2ed573';
          }
        }
      }
    },
    label({ for: 'deckName', style: 'font-size:0.85rem; font-weight:bold; color:#353b48;' }, chrome.i18n.getMessage('exportSendToAnkiDeckName') || 'Deck name'),
    input({
      id: 'deckName', name: 'deckName', type: 'text', required: true, list: 'deckList', value: mainState.title,
      style: 'padding:10px; border-radius:6px; border:1px solid #ced6e0; width:100%; box-sizing:border-box; outline:none;'
    }),
    datalist({ id: 'deckList' }, mainState.deckNames.map(name => option({ value: name }, name))),
    
    textarea({
      id: 'userExplanation', name: 'userExplanation', placeholder: 'Enter Explanation here...', rows: 3,
      style: 'padding:10px; border-radius:6px; border:1px solid #ced6e0; width:100%; box-sizing:border-box; outline:none; resize:vertical; font-family:inherit;'
    }),
    
    button({
      id: 'anki-submit-btn', // أضفنا ID للتحكم بالزر
      type: 'submit',
      style: 'padding:10px; border-radius:6px; border:none; background-color:#2ed573; color:white; font-weight:bold; cursor:pointer; margin-top:5px; transition: background-color 0.2s;'
    }, chrome.i18n.getMessage('exportSendToAnkiSend') || 'Send')
  )
)