const dynamicRatingRegexp = /^[0-9].[0-9]{4}(\s+[A-Z])?$/

let ustaNorCalPlayerPageCache
let tennisRecordRatingCache, tennisRecordPlayerPageCache
let utrRecordRatingCache, utrRecordPlayerAPICache

function showRating(info, trURL, rating) {
    // console.log({info, trURL, rating})
    info.classList.remove('loading')
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
        if (rating === "❔") content.title = "Rating not found on TennisRecord"
    }

    const head = document.createElement('span')
    head.className = 'pill-label'
    head.innerText = "TR"

    info.appendChild(head)
    info.appendChild(content)
}

function applyLoadingTimeout(info) {
    setTimeout(() => {
        if (!info.classList.contains('loading')) return
        info.classList.remove('loading')
        const content = document.createElement('span')
        content.innerText = "⏱"
        content.title = "Timed out"
        info.appendChild(content)
    }, 30000)
}

function showLoading(container) {
    const info = document.createElement('span');
    info.className = 'rating-pill tr-info loading';

    const head = document.createElement('span')
    head.className = 'pill-label'
    head.innerText = "TR"
    info.appendChild(head)

    container.appendChild(info)
    applyLoadingTimeout(info)
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

    if (target.textContent.trim() === 'My Profile') return

    const container = target.parentElement
    if (settings.showTR) showTRInfo(container, id)
    if (settings.showUTRS || settings.showUTRD) showUTRInfo(container, id)
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
            if (!body) {
                showRating(info, "", "🚫")
                info.querySelector('span:last-child').title = "TennisRecord lookup failed"
                return
            }
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

async function showUTRInfo(container, id) {
    console.log(`[UTR] showUTRInfo start — player id=${id}`)
    const singlesInfo = settings.showUTRS ? showLoadingUTR(container, "UTR-S") : null
    const doublesInfo = settings.showUTRD ? showLoadingUTR(container, "UTR-D") : null

    // Reuse the already-fetched USTA NorCal player page for name and location.
    let data = await chrome.storage.session.get("ustaNorCalPlayerPageCache");
    const cache = data.ustaNorCalPlayerPageCache || {}
    let body = cache[id]
    if (!body) {
        console.log(`[UTR] fetching USTA NorCal player page for id=${id}`)
        body = await fetchUSTANorCalPlayerPage(id)
        console.log(`[UTR] USTA NorCal player page fetched — body length=${body?.length ?? 'null'}`)
    } else {
        console.log(`[UTR] USTA NorCal player page for id=${id} served from cache`)
    }
    const { firstName, lastName, location } = parseUSTANorCalPlayerPage(body)
    console.log(`[UTR] parsed player — firstName=${firstName}, lastName=${lastName}, location=${location}`)

    const { lat, lng } = await geocodeLocation(location)
    console.log(`[UTR] geocoded location="${location}" — lat=${lat}, lng=${lng}`)

    if (lat == null || lng == null) {
        console.warn(`[UTR] geocoding failed for location="${location}" — skipping UTR lookup`)
    }

    // Always fetch fresh from UTR — this is the auth check too.
    console.log(`[UTR] fetching UTR player — query="${firstName} ${lastName}", location=${location}, lat=${lat}, lng=${lng}`)
    const player = await fetchUTRPlayer(firstName, lastName, location, lat, lng)
    console.log(`[UTR] fetchUTRPlayer result:`, player === UTR_AUTH_REQUIRED ? 'UTR_AUTH_REQUIRED' : player)

    if (player === UTR_AUTH_REQUIRED) {
        console.warn(`[UTR] auth required — user not logged in to UTR`)
        singlesInfo?.remove()
        doublesInfo?.remove()
        showUTRLogin(container)
        return
    }

    if (!player) {
        console.log(`[UTR] no matching player found for "${firstName} ${lastName}"`)
        if (singlesInfo) showUTRRating(singlesInfo, "UTR-S", null, null)
        if (doublesInfo) showUTRRating(doublesInfo, "UTR-D", null, null)
        return
    }

    const profileURL = `https://app.utrsports.net/profiles/${player.id}`
    // NOTE: field paths below may need adjustment depending on live API response shape.
    const singlesUtr = player.singlesUtr ?? player.ratings?.singles?.utr ?? null
    const doublesUtr = player.doublesUtr ?? player.ratings?.doubles?.utr ?? null
    console.log(`[UTR] matched player id=${player.id}, singlesUtr=${singlesUtr}, doublesUtr=${doublesUtr}`)
    console.log(`[UTR] raw player object:`, JSON.stringify(player))

    if (singlesInfo) showUTRRating(singlesInfo, "UTR-S", profileURL, singlesUtr)
    if (doublesInfo) showUTRRating(doublesInfo, "UTR-D", profileURL, doublesUtr)
}


function showUTRLogin(container) {
    const info = document.createElement('span')
    info.className = 'rating-pill utr-login'

    const head = document.createElement('span')
    head.className = 'pill-label'
    head.innerText = "UTR"
    info.appendChild(head)

    const link = document.createElement('a')
    link.href = "https://app.utrsports.net/login"
    link.target = '_blank'
    link.innerText = "🔒 login"
    info.appendChild(link)

    container.appendChild(info)
}

function showLoadingUTR(container, label) {
    const info = document.createElement('span');
    info.className = 'rating-pill utr-info loading';

    const head = document.createElement('span')
    head.className = 'pill-label'
    head.innerText = label
    info.appendChild(head)

    container.appendChild(info)
    applyLoadingTimeout(info)
    return info
}

function showUTRRating(info, label, profileURL, rating) {
    info.classList.remove('loading')
    info.innerText = ""

    const head = document.createElement('span')
    head.className = 'pill-label'
    head.innerText = label
    info.appendChild(head)

    let content
    if (profileURL && rating != null) {
        content = document.createElement('a')
        content.href = profileURL
        content.target = '_blank'
        content.innerText = `${rating}`
    } else {
        content = document.createElement('span')
        content.innerText = rating != null ? `${rating}` : "❔"
        if (rating == null) content.title = "Rating not found on UTR"
    }
    info.appendChild(content)
}

async function geocodeLocation(location) {
    if (!location) {
        console.warn(`[UTR] geocodeLocation called with empty location`)
        return { lat: null, lng: null }
    }

    location = location.trim().toLowerCase()
    const cacheKey = `geocode:${location}`
    const cached = await chrome.storage.local.get(cacheKey)
    if (cached[cacheKey]) {
        console.log(`[UTR] geocode cache hit for "${location}":`, cached[cacheKey])
        return cached[cacheKey]
    }

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`
    console.log(`[UTR] geocoding "${location}" via Nominatim — url=${url}`)
    return new Promise(resolve => {
        chrome.runtime.sendMessage({ type: "fetchJSON", url }, data => {
            console.log(`[UTR] Nominatim response for "${location}":`, data)
            if (data && data.length > 0) {
                const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
                console.log(`[UTR] geocode result for "${location}":`, result)
                chrome.storage.local.set({ [cacheKey]: result })
                resolve(result)
            } else {
                console.warn(`[UTR] geocode returned no results for "${location}"`)
                resolve({ lat: null, lng: null })
            }
        })
    })
}

const UTR_AUTH_REQUIRED = Symbol('UTR_AUTH_REQUIRED')

async function fetchUTRPlayer(firstName, lastName, location, lat, lng) {
    // Require geocoded coordinates — without them we can't enforce proximity
    // and risk matching a same-named player in a completely different city.
    if (lat == null || lng == null) {
        console.warn(`[UTR] fetchUTRPlayer skipped — no coordinates for "${firstName} ${lastName}"`)
        return null
    }

    const query = `${firstName} ${lastName}`
    const params = new URLSearchParams({
        query,
        top: 40,
        skip: 0,
        distance: "20mi",
        utrType: "verified",
        utrTeamType: "singles",
        showTennisContent: true,
        showPickleballContent: false,
        searchOrigin: "searchPage",
    })
    if (location) params.set("location", location)
    params.set("pin", `${lat},${lng}`)

    const url = `https://api.utrsports.net/v2/search/players?${params}`
    console.log(`[UTR] API request — url=${url}`)
    return new Promise(resolve => {
        chrome.runtime.sendMessage({ type: "fetchJSONWithStatus", url }, result => {
            console.log(`[UTR] API raw result for "${firstName} ${lastName}":`, result)
            if (!result) {
                console.error(`[UTR] API returned null/undefined result`)
                return resolve(null)
            }
            const { status, data } = result
            console.log(`[UTR] API HTTP status=${status}`)
            if (!data) {
                console.error(`[UTR] API response missing data field — full result:`, JSON.stringify(result))
                return resolve(null)
            }
            // NOTE: adjust the path below if the API response shape differs.
            const hits = data.hits?.hits ?? data.hits ?? []
            console.log(`[UTR] API hits count=${hits.length}`)
            if (hits.length > 0) {
                console.log(`[UTR] first hit sample:`, JSON.stringify(hits[0]))
            }
            // Detect unauthenticated: UTR returns showDecimals=false and masked "0.xx" ratings when not logged in
            if (hits.length > 0 && hits[0].source.singlesUtr === 0 && hits[0].source.doublesUtr === 0) {
                console.warn(`[UTR] singlesUtr=0 and doublesUtr=0 detected — user not authenticated`)
                return resolve(UTR_AUTH_REQUIRED)
            }
            const name = `${firstName} ${lastName}`.toLowerCase()
            const match = hits.find(h => {
                const src = h._source ?? h.source ?? h
                const displayName = (src.displayName ?? src.name ?? "").toLowerCase()
                console.log(`[UTR] comparing "${displayName}" to "${name}"`)
                return displayName === name
            })
            if (!match) {
                console.log(`[UTR] no exact name match found for "${name}" among ${hits.length} hits`)
                return resolve(null)
            }
            console.log(`[UTR] matched hit:`, JSON.stringify(match))
            resolve(match._source ?? match.source ?? match)
        })
    })
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

        const parts = text.trim().split(' ')
        trRating = parseFloat(parts[0]).toFixed(2) + (parts[1] ? ` ${parts[1]}` : '')
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
            resolve({url, body})
        })
    })
}


const DEFAULTS = { showTR: true, showUTRS: true, showUTRD: true }
let settings = { ...DEFAULTS }

chrome.storage.sync.get(DEFAULTS, s => {
    settings = s
    document.querySelectorAll('a').forEach(showInfo)
})

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return

    for (const [key, { newValue }] of Object.entries(changes)) {
        settings[key] = newValue
    }

    const trChanged = 'showTR' in changes
    const utrChanged = 'showUTRS' in changes || 'showUTRD' in changes

    document.querySelectorAll('a').forEach(target => {
        const matches = target.href.match(/playermatches\.asp\?id=(\d+)$/)
        if (!matches) return
        const id = matches[1]
        const container = target.parentElement

        if (trChanged) {
            container.querySelectorAll('.tr-info').forEach(el => el.remove())
            if (settings.showTR) showTRInfo(container, id)
        }

        if (utrChanged) {
            container.querySelectorAll('.utr-info, .utr-login').forEach(el => el.remove())
            if (settings.showUTRS || settings.showUTRD) showUTRInfo(container, id)
        }
    })
})

