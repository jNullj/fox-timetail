import { Modal } from './modal.mjs'
import { calculateDailyTime, jsonToHistory } from './history_utils.mjs'

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
        fetch(`/api/history?year=${this.year}&month=${this.month}`)
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
                const formattedDailyTime = `${hours}:${minutes < 10 ? '0' : ''}${minutes}`
                let timeEventsLog = ''
                for (let i = 0; i < entries.length; i++) {
                    const prefix = entries[i].type === 'enter' ? 'i' : 'o'
                    timeEventsLog += `${prefix}: ${entries[i].time.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit' })} `
                }
                return `${date}@${formattedDailyTime} - ${timeEventsLog}`
            })
            this.historyLog.innerText = `Entrances and Exits for ${this.year}-${this.month}:\n${formattedHistory.join('\n')}`
            this.historyLog.style.display = 'block'
        })
    }
}
