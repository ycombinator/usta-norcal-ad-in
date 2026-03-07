chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    switch (message.type) {
        case "fetchPage":
            console.log(`[BG] fetchPage — url=${message.url}`)
            fetch(message.url)
                .then(res => {
                    console.log(`[BG] fetchPage response — status=${res.status}, ok=${res.ok}, url=${message.url}`)
                    return res.text()
                })
                .then(body => {
                    console.log(`[BG] fetchPage body length=${body?.length} — url=${message.url}`)
                    sendResponse(body)
                })
                .catch(err => {
                    console.error(`[BG] fetchPage error — url=${message.url}`, err)
                    sendResponse(null)
                })
            break
        case "fetchJSON":
            console.log(`[BG] fetchJSON — url=${message.url}`)
            fetch(message.url, { credentials: 'include' })
                .then(res => {
                    console.log(`[BG] fetchJSON response — status=${res.status}, ok=${res.ok}, url=${message.url}`)
                    return res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))
                })
                .then(data => {
                    console.log(`[BG] fetchJSON data — url=${message.url}`, data)
                    sendResponse(data)
                })
                .catch(err => {
                    console.error(`[BG] fetchJSON error — url=${message.url}`, err)
                    sendResponse(null)
                })
            break
        case "fetchJSONWithStatus":
            console.log(`[BG] fetchJSONWithStatus — url=${message.url}`)
            fetch(message.url, { credentials: 'include' })
                .then(res => {
                    console.log(`[BG] fetchJSONWithStatus response — status=${res.status}, ok=${res.ok}, url=${message.url}`)
                    return res.json().then(data => ({ status: res.status, data }))
                })
                .then(result => {
                    console.log(`[BG] fetchJSONWithStatus result — status=${result.status}, url=${message.url}`, result.data)
                    sendResponse(result)
                })
                .catch(err => {
                    console.error(`[BG] fetchJSONWithStatus error — url=${message.url}`, err)
                    sendResponse(null)
                })
            break
    }
    return true
});

chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
