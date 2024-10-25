import { HistoryModal } from "./historyModal.mjs"

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
    })
    exitButton.addEventListener('click', () => {
        fetch('/api/exit', { method: 'POST' })
    })
    historyButton.addEventListener('click', () => {
        historyModal.show()
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