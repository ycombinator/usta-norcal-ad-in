chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    switch (message.type) {
        case "fetchPage":
            fetch(message.url)
                .then(res => res.text())
                .then(body => sendResponse(body))
                .catch(err => { console.error(err); sendResponse(null) })
            break
        case "fetchJSON":
            fetch(message.url, { credentials: 'include' })
                .then(res => res.json())
                .then(data => sendResponse(data))
                .catch(err => { console.error(err); sendResponse(null) })
            break
        case "fetchJSONWithStatus":
            fetch(message.url, { credentials: 'include' })
                .then(res => res.json().then(data => ({ status: res.status, data })))
                .then(result => sendResponse(result))
                .catch(err => { console.error(err); sendResponse(null) })
            break
    }
    return true
});

chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
