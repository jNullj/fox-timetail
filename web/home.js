import { HistoryModal } from "./historyModal.mjs"
import { History } from "./History.mjs"

document.addEventListener('DOMContentLoaded', () => {
    const entranceButton = document.getElementById('entranceButton')
    const exitButton = document.getElementById('exitButton')
    const statusIcon = document.getElementById('statusIcon')
    const currentTime = document.getElementById('currentTime')
    const dayPercentage = document.getElementById('dayPercentage')
    const historyButton = document.getElementById('historyButton')
    const workdayMs = 1000 * 60 * 60 * 9  // 9 hours in milliseconds
    const historyModal = new HistoryModal(document.body)

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/serviceWorker.js')
    }

    entranceButton.addEventListener('click', () => {
        fetch('/api/enter', { method: 'POST' })
        .then(response => {
            if (response.status === 503) {
                const history = new History()
                history.add('enter')
                alert('You are offline. Your entrance will be synced when you are back online.')
            }
        })
        .catch(() => {
            const history = new History()
            history.add('enter')
            alert('You are offline. Your entrance will be synced when you are back online.')
        })
    })
    exitButton.addEventListener('click', () => {
        fetch('/api/exit', { method: 'POST' })
        .then(response => {
            if (response.status === 503) {
                const history = new History()
                history.add('exit')
                alert('You are offline. Your exit will be synced when you are back online.')
            }
        })
        .catch(() => {
            const history = new History()
            history.add('exit')
            alert('You are offline. Your exit will be synced when you are back online.')
        })
    })
    historyButton.addEventListener('click', () => {
        historyModal.show()
    })

    // update the current session time every second
    setInterval(() => {
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1
        History.fetchFromApi(year, month)
            .then(history => {
                const sessionTime = history.dailyTime(now).getTime()
                const hours = Math.floor(sessionTime / (1000 * 60 * 60))
                const minutes = Math.floor((sessionTime / (1000 * 60)) % 60)
                const seconds = Math.floor((sessionTime / 1000) % 60)
                const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                currentTime.innerText = formattedTime
                dayPercentage.innerText = Math.floor((sessionTime / workdayMs) * 100) + '%'
                statusIcon.className = history.isAtWork() ? 'active' : 'inactive'
            })
    }, 1000)
})