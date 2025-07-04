const dynamicRatingRegexp = /^[0-9].[0-9]{4}(\s+[A-Z])?$/

let ustaNorCalPlayerPageCache
let tennisRecordRatingCache, tennisRecordPlayerPageCache
let utrRecordRatingCache, utrRecordPlayerAPICache

function showRating(info, trURL, rating) {
    // console.log({info, trURL, rating})
    info.innerText = ""

    let content
    if (trURL != "") {
        content = document.createElement('a')
        content.href = trURL
        content.target = '_blank'
        content.innerText = `${rating}`
    } else {
        content = document.createElement('span')
        content.innerText = `${rating}`
    }

    const head = document.createElement('h4')
    head.innerText = "TR"

    info.appendChild(head)
    info.appendChild(content)
}

function showLoading(container) {
    const info = document.createElement('span');
    info.className = 'tr-info';
    info.innerText = "Loading..."

    container.appendChild(info)
    return info
}

function showInfo(target) {
    const url = target.href;
    if (url == "") {
        return
    }

    const matches = url.match(/playermatches.asp\?id=(\d+)$/)
    if (!matches || matches.length != 2) {
        return
    }
    const id = matches[1]

    const container = target.parentElement
    // Show TR info
    showTRInfo(container, id)
    // Show UTR info
    showUTRInfo(container, id)
}

async function showTRInfo(container, id) {
    const info = showLoading(container)

    let data = await chrome.storage.session.get("ratingCache");
    tennisRecordRatingCache = data.ratingCache || {}

    if (tennisRecordRatingCache.hasOwnProperty(id)) {
        console.log(`returning rating for ${id} from cache`)
        const { trURL, rating } = tennisRecordRatingCache[id]
        if (trURL && rating) {
            showRating(info, trURL, rating)
            return
        }
    }

    // Fetch USTA NorCal player page and parse out player's 
    // first name, last name, and location.
    data = await chrome.storage.session.get("ustaNorCalPlayerPageCache");
    ustaNorCalPlayerPageCache = data.ustaNorCalPlayerPageCache || {}

    if (ustaNorCalPlayerPageCache.hasOwnProperty(id)) {
        console.log(`returning USTA NorCal player page body for ${id} from cache`)
    } else {
        console.log(`returning USTA NorCal player page body for ${id} from source`)
        const body = await fetchUSTANorCalPlayerPage(id)
        ustaNorCalPlayerPageCache[id] = body
        chrome.storage.session.set({ustaNorCalPlayerPageCache})
    }
    const body = ustaNorCalPlayerPageCache[id]

    const { firstName, lastName, location } = parseUSTANorCalPlayerPage(body)

    // Fetch TennisRecord player page and parse out player's
    // estimated dynamic rating.
    // TODO: use cache
    data = await chrome.storage.session.get("tennisRecordPlayerPageCache");
    // tennisRecordPlayerPageCache = data.tennisRecordPlayerPageCache || {}
    tennisRecordPlayerPageCache = {}

    let trURL, rating
    if (tennisRecordPlayerPageCache.hasOwnProperty(id)) {
        console.log(`returning tennis record player page body for ${firstName} ${lastName} from cache`)
        const { url, body } = tennisRecordPlayerPageCache[id]
        const { trRating } = parseTennisRecordPlayerPage(body, firstName, lastName)
        trURL = url
        rating = trRating
    } else {
        for (let s = 1; s <= 20; s++) {
            console.log(`returning tennis record player page body for ${firstName} ${lastName} (${s}) from source`)
            const { url, body } = await fetchTennisRecordPlayerPage(firstName, lastName, s)
            const { trLocation, trRating } = parseTennisRecordPlayerPage(body, firstName, lastName)
            if (location == trLocation) {
                // console.log("location match!")
                trURL = url
                rating = trRating

                // tennisRecordPlayerPageCache[id] = body
                // chrome.storage.session.set({tennisRecordPlayerPageCache})

                break
            }
        }
    }

    if (trURL && rating) {
        tennisRecordRatingCache[id] = {trURL, rating }
        chrome.storage.session.set({ratingCache: tennisRecordRatingCache})
        showRating(info, trURL, rating)
    } else {
        showRating(info, "", "❔")
    }
};

// TODO
async function showUTRInfo(container, id) {
    // const info = showLoading(container)

    // https://api.utrsports.net/v2/search/players?query=shaunak+kashyap&top=40&skip=0&distance=25mi&pin=37.33874%2C-121.8852525&utrType=verified&utrTeamType=singles&showTennisContent=true&showPickleballContent=false&searchOrigin=searchPage
}

function parseUSTANorCalPlayerPage(body) {
    // console.log(body)
    const p = new DOMParser()
    const document = p.parseFromString(body, "text/html")

    let firstName, lastName
    document.querySelectorAll("table tbody tr td font b").forEach(n => {
        const text = n.innerText.trim()
        const parts = text.split(/\s+/)
        firstName = parts.shift()
        lastName = parts.join(" ")
    })

    let location
    let isLocationNext = false
    document.querySelectorAll("table tbody tr.PlayerInfo td b").forEach(n => {
        const text = n.innerText.trim()
        if (isLocationNext) {
            isLocationNext = false
            location = text
        }

        if (text.match(/\d\.\d/)) {
            isLocationNext = true
        }
    })

    // console.log({firstName, lastName, location})
    return {firstName, lastName, location}
}

function parseTennisRecordPlayerPage(body, firstName, lastName) {
    // console.log(body)
    const p = new DOMParser()
    const document = p.parseFromString(body, "text/html")

    const name = firstName + " " + lastName
    let trLocation
    document.querySelectorAll("table tbody tr td a.link").forEach(n => {
        // console.log("finding location...")
        const text = n.innerText.trim()
        if (text.toLowerCase() == name.toLowerCase()) {
            const locationText = n.parentElement.childNodes[2].data.trim()
            const parts = locationText.match(/\((.+)\)/)
            trLocation = parts[1]
            return
        }
    })

    let trRating
    document.querySelectorAll("span").forEach(n => {
        if (trRating) {
            return
        }

        const text = n.innerText.trim()
        if (!text.match(dynamicRatingRegexp)) {
            return
        }

        trRating = text.trim()
        // console.log({ firstName, lastName, trRating})
        return
    })

    return {trLocation, trRating}
}

async function fetchUSTANorCalPlayerPage(id) {
    const url = `https://leagues.ustanorcal.com/playermatches.asp?id=${id}`
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({type: "fetchPage", url}, body => {
            // console.log(body)
            return resolve(body)
        })
    })
}

async function fetchTennisRecordPlayerPage(firstName, lastName, s) {
    const url = `https://www.tennisrecord.com/adult/profile.aspx?playername=${firstName}%20${lastName}&s=${s}`
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({type: "fetchPage", url}, body => {
            // console.log(body)
            // tennisRecordPlayerPageCache[cacheKey] = body
            resolve({url, body})
        })
    })
}


document.querySelectorAll('a').forEach(showInfo)

