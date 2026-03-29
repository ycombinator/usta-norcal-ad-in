# Changelog

## 0.5.0
- Automatically invalidate cached TR ratings when TennisRecord's rating date changes, ensuring stale ratings are refreshed without restarting the browser

## 0.4.0
- Match TennisRecord players by cross-referencing team history from USTA NorCal and TennisRecord profiles, fixing cases where location strings don't match
- Fix rating pills appearing on the "My Profile" nav link
- Fix doubles scorecard pages showing all 6 pills next to the second player's name; pills now appear next to each respective player
- Round TennisRecord ratings to 2 decimal places

## 0.3.3
- Fix UTR authentication check to detect unauthenticated state via `singlesUtr == 0 && doublesUtr == 0`

## 0.3.2
- Fix UTR authentication check to correctly read `hits[0].source`

## 0.3.1
- Add verbose UTR debug logging

## 0.3.0
- Add settings (via popup) to toggle TR, UTR-S, and UTR-D ratings on/off independently
- Show only UTR-D for mixed doubles teams (UTR-S brought back subsequently)
- Cache UTR ratings for a day; cache city geocoding results indefinitely
- Require lat/long coordinates to match UTR players, preventing false matches across cities
- Bug fixes and performance improvements

## 0.2.3
- Bug fixes and performance improvements (TR lookup error handling, timeout on loading, caching improvements)

## 0.2.2
- Add tooltips for unresolved ratings
- UI improvements: flex layout for pills, loading shimmer, updated pill styling

## 0.2.1
- Implement UTR singles and doubles rating lookup via api.utrsports.net
- Show UTR login prompt when user is not authenticated
- Add geocoding via Nominatim to enforce proximity matching for UTR lookups

## 0.2.0
- Add UTR support (initial groundwork)
- Match TennisRecord players by location
- Deduplicate CSS, improve pill layout

## 0.1.0
- Initial release: TennisRecord dynamic rating lookup for USTA NorCal player links
- Display rating pill next to player names on leagues.ustanorcal.com
