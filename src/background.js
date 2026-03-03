chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    switch (message.type) {
        case "fetchPage":
            console.log({message})
            fetch(message.url)
                .then(res => res.text())
                .then(body => { console.log(body); sendResponse(body) })
            break
        case "fetchJSON":
            console.log({message})
            fetch(message.url)
                .then(res => res.json())
                .then(data => { console.log(data); sendResponse(data) })
                .catch(err => { console.error(err); sendResponse(null) })
            break
    }
    return true
});

chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
