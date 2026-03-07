const DEFAULTS = { showTR: true, showUTRS: true, showUTRD: true }

const ids = ['showTR', 'showUTRS', 'showUTRD']

chrome.storage.sync.get(DEFAULTS, settings => {
    ids.forEach(id => {
        const el = document.getElementById(id)
        el.checked = settings[id]
        el.addEventListener('change', () => {
            chrome.storage.sync.set({ [id]: el.checked })
        })
    })
})
