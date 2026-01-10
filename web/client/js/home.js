import { HistoryModal } from "./historyModal.mjs"
import { History, MODIFIERS } from "./History.mjs"

document.addEventListener('DOMContentLoaded', () => {
    const entranceButton = document.getElementById('entranceButton')
    const exitButton = document.getElementById('exitButton')
    const sickButton = document.getElementById('sickButton')
    const vacationButton = document.getElementById('vacationButton')
    const statusIcon = document.getElementById('statusIcon')
    const currentTime = document.getElementById('currentTime')
    const dayPercentage = document.getElementById('dayPercentage')
    const historyButton = document.getElementById('historyButton')
    const workdayMs = 1000 * 60 * 60 * 9  // 9 hours in milliseconds
    const historyModal = new HistoryModal(document.body)
    let cachedHistory = null
    try {
        const history = new History()
        cachedHistory = history
    } catch (error) {
        console.error('Failed to load history at startup:', error)
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker/serviceWorker.js')
    }

    // Helper to send presence updates (enter/exit) and handle offline fallback
    function sendPresenceUpdate(statusLabel, opts = {}) {
        const pathMap = {
            'enter': '/api/enter',
            'exit': '/api/exit',
            'sick': '/api/sick',
            'vacation': '/api/vacation'
        }
        const path = pathMap[statusLabel]
        const isModifier = MODIFIERS.includes(statusLabel)
        const options = opts.replace ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ replace: true }) } : { method: 'POST' }

        fetch(path, options)
        .then(async response => {
            if (response.status === 503) {
                const history = new History()
                history.add(statusLabel)
                alert(`You are offline. Your ${statusLabel} will be synced when you are back online.`)
                return
            }
            if (response.status === 200) {
                // Improve UX by immediately updating the UI and cached history
                fetchHistoryFromApi()
                fetchHistoryInterval.refresh()
                return
            }
            if (response.status === 409 && isModifier) {
                // Conflict: parse existing modifier and ask user whether to replace
                let data
                try { data = await response.json() } catch (e) { data = null }
                const conflict = data && data.conflict ? data.conflict : 'unknown modifier'
                const confirmReplace = confirm(`This day is already marked as ${conflict}. Replace with ${statusLabel}?`)
                if (confirmReplace) {
                    // Re-run the same logic with replace flag so handling/UX stays consistent
                    sendPresenceUpdate(statusLabel, { replace: true })
                }
                return
            }
        })
        .catch(() => {
            const history = new History()
            history.add(statusLabel)
            alert(`You are offline. Your ${statusLabel} will be synced when you are back online.`)
        })
    }

    entranceButton.addEventListener('click', () => sendPresenceUpdate('enter'))
    exitButton.addEventListener('click', () => sendPresenceUpdate('exit'))
    sickButton.addEventListener('click', () => sendPresenceUpdate('sick'))
    vacationButton.addEventListener('click', () => sendPresenceUpdate('vacation'))
    historyButton.addEventListener('click', () => {
        historyModal.show()
    })

    // Fetch history from API once when the page is loaded
    fetchHistoryFromApi()

    // Fetch history from API and update cache every 10 seconds
    const fetchHistoryInterval = (function() {
        let id = setInterval(fetchHistoryFromApi, 10000)
        return {
            refresh() {
                if (id) {
                    clearInterval(id)
                }
                id = setInterval(fetchHistoryFromApi, 10000)
            }
        }
    })()

    // Update the current session time every second using cached history
    setInterval(() => {
        if (cachedHistory) {
            updateTimeUI(cachedHistory)
        }
    }, 1000)

    function fetchHistoryFromApi() {
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1
        History.fetchFromApi(year, month)
            .then(history => {
                cachedHistory = history
            })
            .catch(error => {
                console.error('Failed to fetch history:', error)
            })
    }

    function updateTimeUI(history) {
        const now = new Date()
        const sessionTime = history.dailyTime(now).getTime()
        const hours = Math.floor(sessionTime / (1000 * 60 * 60))
        const minutes = Math.floor((sessionTime / (1000 * 60)) % 60)
        const seconds = Math.floor((sessionTime / 1000) % 60)
        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        currentTime.innerText = formattedTime
        dayPercentage.innerText = Math.floor((sessionTime / workdayMs) * 100) + '%'
        statusIcon.className = history.isAtWork() ? 'active' : 'inactive'
    }
})