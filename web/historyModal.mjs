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
        fetch(`/api/history?year=${this.year}&month=${this.month}`)
        .then(res => res.json())
        .then(data => {
            const history = new History(new Date(`${this.year}-${this.month}`), data.history)
            const groupedHistory = history.array.reduce((acc, curr) => {
                const date = curr.time.toLocaleDateString()
                if (!acc[date]) {
                    acc[date] = []
                }
                acc[date].push(curr)
                return acc
            }, {})
            const title = document.createElement('h3')
            title.textContent = `Entrances and Exits for ${this.year}-${this.month}`
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
                            const postfix = entries[i].type === 'enter' ? '➡️' : '🕓'
                            timeEventsLog += `${entries[i].time.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit' })}${postfix}`
                        }
                        if (timeEventsLog.endsWith('🕓')) {
                            timeEventsLog = timeEventsLog.slice(0, -2)
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
            this.historyLog.innerHTML = ''
            this.historyLog.appendChild(title)
            this.historyLog.appendChild(table)
            this.historyLog.classList.add('history-log')
            this.historyLog.style.display = 'block'
        })
    }
}
