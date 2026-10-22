import { elementFactory } from '../skruv-0.7.7/skruv.js'

const { div, h2, button, p, a, datalist, form, input, option, br, label, textarea } = elementFactory

import { state as mainState } from '../state.js'
import { sendNotification, getEnabledSubtitles } from '../utils.js'

const scheme = 'http'
const host = 'localhost'
const port = 8765
const MODEL_NAME = 'Youtube2AnkiV2'

/**
 * Format a subtitle as a note for Anki
 *
 * @param {Subtitle} subtitle
 * @param {string} deck
 * @param {string} model
 * @param {string} explanation
 */
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
      allowDuplicate: false
    }
  }
)

/**
 * Obtains deck names form Anki
 * and stores them in the state
 *
 * @param {string} title
 */
const initDecks = async (title) => {
  try {
    const { result: decks } = await (await fetch(`${scheme}://${host}:${port}`,
      {
        method: 'POST',
        body: JSON.stringify({
          action: 'deckNames',
          version: 6
        })
      }
    )).json()

    // Add the title if it does not exist as a deck in Anki
    if (!decks.includes(title)) {
      decks.push(title)
    }

    mainState.deckNames = decks.filter(Boolean)
  } catch (error) {
    console.warn(error)
    mainState.error = {
      message: chrome.i18n.getMessage('exportSendToAnkiError')
    }
  }
}

/**
 * Creates a new deck in Anki with the given name
 *
 * @param {string} deckName
 */
const createDeck = async (deckName) => {
  const createDeckResponse = await fetch(`${scheme}://${host}:${port}`,
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'createDeck',
        version: 6,
        params: {
          deck: deckName
        }
      })
    }
  )

  const { err } = await createDeckResponse.json()
  if (err) throw new Error(err)
}

/**
 * Creates the model in which the cards will be represented
 */
const createModel = async () => {
  const createModelResponse = await fetch(`${scheme}://${host}:${port}`,
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'createModel',
        version: 6,
        params: {
          modelName: MODEL_NAME,
          inOrderFields: [
            'time',
            'nextTime',
            'text',
            'prevText',
            'nextText',
            'id',
            'startSeconds',
            'endSeconds',
            'title',
            'hash',
            'Explanation'
          ],
          css: `
              .card {
                font-family: futura-pt,sans-serif,sans-serif;
                font-size: 20px;
                text-align: center;
                color: black;
                background-color: #e9e9e9;
              }

              span {
                font-size: 0.9rem;
                color: #3c3c3c;
              }
            `,
          cardTemplates: [
            {
              Front: `
                      {{title}}
                      <br>

                      <span>{{prevText}}</span>
                      <br>

                      {{text}}
                      <br>

                      <iframe
                          width="560"
                          height="315"
                          src="https://www.youtube.com/embed/{{id}}?start={{startSeconds}}&end={{endSeconds}}&autoplay=1"
                          frameborder=0
                            autoplay=1
                      />

                      <br>
                      <span>{{time}} - {{nextTime}}</span>
                      <br>
                      <span>{{nextText}}</span>
                    `,
              Back: `
                      {{FrontSide}}
                      <hr id=answer>
                      {{Explanation}}
                    `
            }
          ]
        }
      })
    }
  )

  const { errorCreateModel } = await createModelResponse.json()
  if (errorCreateModel) throw new Error(errorCreateModel)
}

/**
 * Makes sure the model has an "Explanation" field.
 * Models created by earlier versions of the extension do not have it,
 * and Anki cannot fill in a field that does not exist.
 */
const ensureExplanationField = async () => {
  const fieldNamesResponse = await fetch(`${scheme}://${host}:${port}`,
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'modelFieldNames',
        version: 6,
        params: {
          modelName: MODEL_NAME
        }
      })
    }
  )

  const { result: fieldNames, error: fieldNamesError } = await fieldNamesResponse.json()
  if (fieldNamesError) throw new Error(fieldNamesError)
  if (fieldNames.includes('Explanation')) return

  const addFieldResponse = await fetch(`${scheme}://${host}:${port}`,
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'modelFieldAdd',
        version: 6,
        params: {
          modelName: MODEL_NAME,
          fieldName: 'Explanation'
        }
      })
    }
  )

  const { error: addFieldError } = await addFieldResponse.json()
  if (addFieldError) throw new Error(addFieldError)
}

/**
 * Adds notes directly to Anki in a single batch request
 *
 * @param {Subtitle[]} subtitles
 * @param {string} deckName
 * @param {string} explanation
 */
const openAddCardsWindows = async (subtitles, deckName, explanation) => {
  // 1. تجهيز جميع البطاقات في مجموعة واحدة
  const notes = subtitles.map(subtitle => getNote(subtitle, deckName, MODEL_NAME, explanation))

  // 2. إرسال جميع البطاقات دفعة واحدة بصمت في الخلفية
  const addNotesResponse = await fetch(`${scheme}://${host}:${port}`,
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'addNotes',
        version: 6,
        params: {
          notes: notes
        }
      })
    }
  )
  const response = await addNotesResponse.json()
  if (response.error) throw new Error(response.error)
}

/**
 * Component that handles Connection to Anki
 */
export const ExportAnki = () => div(
  {
    class: 'card',
    skruvAfterCreate: async () => {
      await initDecks(mainState.title)
    }
  },
  h2({}, chrome.i18n.getMessage('exportSendToAnkiTitle')),
  p({},
    chrome.i18n.getMessage('exportSendToAnkiDescription1'),
    a({
      href: 'https://ankiweb.net/shared/info/2055492159',
      target: '_blank'
    }, 'Anki Connect'),
    chrome.i18n.getMessage('exportSendToAnkiDescription2')
  ),
  !!mainState.error?.message && p({}, mainState.error.message),
  !!mainState.error?.message && button({
    class: 'btn',
    onclick: async () => {
      mainState.error = {}
      await initDecks(mainState.title)
    }
  },
    chrome.i18n.getMessage('exportSendToAnkiReconnect')
  ),
  !!mainState.deckNames &&
  form(
    {
      onsubmit: async (/** @type {Event} */e) => {
        e.preventDefault()
        // @ts-ignore
        const formData = new FormData(e.target)
        const deckName = /** @type {string} */(formData.get('deckName'))
        const explanation = /** @type {HTMLTextAreaElement | null} */(document.getElementById('userExplanation'))?.value ?? ''

        try {
          const subtitles = getEnabledSubtitles(mainState.subtitles)

          await createDeck(deckName)
          await createModel()
          await ensureExplanationField()
          await openAddCardsWindows(subtitles, deckName, explanation)

          sendNotification(
            chrome.i18n.getMessage('exportSendToAnkiNotificationTitle'),
            chrome.i18n.getMessage('exportSendToAnkiNotificationOpened', String(subtitles.length)),
            () => window.close()
          )
        } catch (error) {
          console.error(error)
          sendNotification(
            chrome.i18n.getMessage('exportSendToAnkiErrorCreating'),
            // @ts-expect-error
            error.message
          )
        }
      }
    },
    label({ for: 'deckName' }, chrome.i18n.getMessage('exportSendToAnkiDeckName')),
    input({
      id: 'deckName',
      name: 'deckName',
      type: 'text',
      required: true,
      list: 'deckList',
      value: mainState.title
    }),
    datalist({
      id: 'deckList'
    }, mainState.deckNames.map(name => option({
      value: name
    }, name))),
    br({}),
    br({}),
    textarea({
      id: 'userExplanation',
      name: 'userExplanation',
      placeholder: 'Enter Explanation here...',
      rows: 4
    }),
    br({}),
    br({}),
    button({
      type: 'submit',
      class: 'btn'
    }, chrome.i18n.getMessage('exportSendToAnkiSend'))
  )
)

/**
 * @typedef {import('../../interfaces').Subtitle} Subtitle
 */