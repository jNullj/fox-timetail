import { Modal } from './modal.mjs'
import { History } from './History.mjs'

export class HistoryModal extends Modal {
    constructor(parent) {
        super(parent)

        this.year = null
        this.month = null

        this.createYearGrid()
        this.createMonthGrid()
        this.createHistoryLog()
    }

    close() {
        super.close()
        this.yearGrid.style.display = 'grid'
        this.monthGrid.style.display = 'none'
        this.historyLog.style.display = 'none'
        this.historyLog.innerText = ''
        this.year = null
        this.month = null
    }

    createYearGrid() {
        this.yearGrid = document.createElement('div')
        this.yearGrid.id = 'yearGrid'
        this.yearGrid.className = 'grid-3-x-3'
        this.content.appendChild(this.yearGrid)

        const currentYear = new Date().getFullYear()
        const startYear = currentYear - 4
        const endYear = currentYear + 4
    
        for (let year = startYear; year <= endYear; year++) {
            const div = document.createElement('div')
            div.className = 'grid-item'
            if (year === currentYear) {
                div.classList.add('selected-grid-item')
            }
            div.textContent = year
            div.addEventListener('click', () => {
                this.year = year
                this.yearGrid.style.display = 'none'
                this.monthGrid.style.display = 'grid'
            })
            this.yearGrid.appendChild(div)
        }
    }

    createMonthGrid() {
        this.monthGrid = document.createElement('div')
        this.monthGrid.id = 'monthGrid'
        this.monthGrid.className = 'grid-4-x-3'
        this.monthGrid.style.display = 'none'
        this.content.appendChild(this.monthGrid)

        const currentMonth = new Date().getMonth() + 1
    
        for (let month = 1; month <= 12; month++) {
            const div = document.createElement('div')
            div.className = 'grid-item'
            if (month === currentMonth) {
                div.classList.add('selected-grid-item')
            }
            div.textContent = month
            div.addEventListener('click', () => {
                this.month = month
                this.monthGrid.style.display = 'none'
                this.showHistoryData()
            })
            monthGrid.appendChild(div)
        }
    }

    createHistoryLog() {
        this.historyLog = document.createElement('div')
        this.historyLog.id = 'historyLog'
        this.historyLog.style.display = 'none'
        this.content.appendChild(this.historyLog)
    }

    showHistoryData() {
        History.fetchFromApi(this.year, this.month)
            .then(history => {
                const groupedHistory = history.array.reduce((acc, curr) => {
                    const date = curr.time.toLocaleDateString()
                    if (!acc[date]) {
                        acc[date] = []
                    }
                    acc[date].push(curr)
                    return acc
                }, {})
                const title = document.createElement('h3')
                title.textContent = `Events for ${this.year}-${this.month}`
                const table = document.createElement('table')
                let monthlyTime = new Date(0)
                table.innerHTML = `
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Daily Time</th>
                            <th>Events</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(groupedHistory).map(([date, entries]) => {
                            const dailyTime = history.dailyTime(new Date(date))
                            monthlyTime = new Date(monthlyTime.getTime() + dailyTime.getTime())
                            const hours = Math.floor(dailyTime.getTime() / (1000 * 60 * 60))
                            const minutes = Math.floor((dailyTime.getTime() / (1000 * 60)) % 60)
                            const formattedDailyTime = `${hours}:${minutes < 10 ? '0' : ''}${minutes}`
                            let timeEventsLog = ''
                            for (let i = 0; i < entries.length; i++) {
                                const entry = entries[i]
                                const entryTimeStr = entry.time.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit' })
                                let iconPostfix = ''
                                if (entry.type === 'sick') {
                                    iconPostfix = '😷'
                                } else if (entry.type === 'enter') {
                                    iconPostfix = '➡️'
                                } else if (entry.type === 'exit') {
                                    iconPostfix = '🕓'
                                } else {
                                    iconPostfix = '❓'
                                }
                                timeEventsLog += `${entryTimeStr}${iconPostfix}`
                            }
                            const dayOfMonths = (new Date(date)).getDate()
                            return `
                                <tr>
                                    <td>${dayOfMonths}</td>
                                    <td>${formattedDailyTime}</td>
                                    <td>${timeEventsLog}</td>
                                </tr>
                            `
                        }).join('')}
                        <tr>
                            <td>Total</td>
                            <td>${Math.floor(monthlyTime.getTime() / (1000 * 60 * 60))}h ${Math.floor((monthlyTime.getTime() / (1000 * 60)) % 60)}m</td>
                            <td></td>
                        </tr>
                    </tbody>
                `
                const downloadButton = this.createDownloadButton(history.array)
                const uploadButton = this.createUploadButton()

                this.historyLog.innerHTML = ''
                this.historyLog.appendChild(title)
                this.historyLog.appendChild(table)
                this.historyLog.appendChild(downloadButton)
                this.historyLog.appendChild(uploadButton)
                this.historyLog.classList.add('history-log')
                this.historyLog.style.display = 'block'
            })
    }

    createUploadButton() {
        const uploadButton = document.createElement('button')
        uploadButton.textContent = 'Upload JSON'

        uploadButton.addEventListener('click', () => {
            const fileInput = document.createElement('input')
            fileInput.type = 'file'
            fileInput.accept = 'application/json'
            fileInput.style.display = 'none'
            fileInput.addEventListener('change', (event) => {
                const file = event.target.files[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = (e) => {
                    try {
                        const json = JSON.parse(e.target.result)
                        fetch('/api/importMonth', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ year: this.year, month: this.month, data: json })
                        })
                        .then(response => response.text())
                        .then(msg => {
                            alert(msg)
                            this.showHistoryData() // refresh after import
                        })
                        .catch(err => {
                            alert('Failed to import history: ' + err)
                        })
                    } catch (err) {
                        alert('Invalid JSON file')
                    }
                }
                reader.readAsText(file)
            })
            // Trigger file dialog
            fileInput.click()
        })

        return uploadButton
    }

    createDownloadButton(data) {
        const downloadButton = document.createElement('button')
        downloadButton.textContent = 'Download JSON'
        downloadButton.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `history_${this.year}_${this.month}.json`
            a.click()
            URL.revokeObjectURL(url)
        })
        return downloadButton
    }
}
