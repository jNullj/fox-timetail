import { calculateDailyTime, jsonToHistory } from "./history_utils.mjs"

document.addEventListener('DOMContentLoaded', () => {
    const entranceButton = document.getElementById('entranceButton')
    const exitButton = document.getElementById('exitButton')
    const statusIcon = document.getElementById('statusIcon')
    const currentTime = document.getElementById('currentTime')
    const dayPercentage = document.getElementById('dayPercentage')
    const historyButton = document.getElementById('historyButton')
    const workdayMs = 1000 * 60 * 60 * 9  // 9 hours in milliseconds

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/serviceWorker.js')
    }

    entranceButton.addEventListener('click', () => {
        fetch('/api/enter', { method: 'POST' })
    })
    exitButton.addEventListener('click', () => {
        fetch('/api/exit', { method: 'POST' })
    })
    historyButton.addEventListener('click', () => {
        fetch('/api/history')
        .then(res => res.json())
        .then(data => {
            const history = jsonToHistory(data.history)
            history.sort((a, b) => a.time - b.time)
            const groupedHistory = history.reduce((acc, curr) => {
                const date = curr.time.toLocaleDateString()
                if (!acc[date]) {
                    acc[date] = []
                }
                acc[date].push(curr)
                return acc
            }, {})
            const formattedHistory = Object.entries(groupedHistory).map(([date, entries]) => {
                const dailyTime = calculateDailyTime(history, new Date(date))
                const hours = Math.floor(dailyTime.getTime() / (1000 * 60 * 60))
                const minutes = Math.floor((dailyTime.getTime() / (1000 * 60)) % 60)
                const formattedDailyTime = `${hours}:${minutes < 10 ? '0' : ''}${minutes}`;
                let timeEventsLog = ''
                for(let i = 0; i < entries.length; i++) {
                    const prefix = entries[i].type === 'enter' ? 'i' : 'o'
                    timeEventsLog += `${prefix}: ${entries[i].time.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit' })} `
                }
                return `${date}@${formattedDailyTime} - ${timeEventsLog}`
            });
            alert(`Entrances and Exits:\n${formattedHistory.join('\n')}`)
        })
    })

    // update the current session time every second
    setInterval(() => {
        fetch('/api/sessionTime')
        .then(res => res.json())
        .then(data => {
            const sessionTime = new Date(data.sessionTime).getTime()
            const hours = Math.floor(sessionTime / (1000 * 60 * 60))
            const minutes = Math.floor((sessionTime / (1000 * 60)) % 60)
            const seconds = Math.floor((sessionTime / 1000) % 60)
            const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            currentTime.innerText = formattedTime
            dayPercentage.innerText = Math.floor((sessionTime / workdayMs) * 100) + '%'
            statusIcon.className = data.isAtWork ? 'active' : 'inactive'
        })
    }, 1000)
})