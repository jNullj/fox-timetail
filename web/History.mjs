import fs from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isClient = typeof window !== 'undefined'

/**
 * History is a class that represents a history of work events.
 * @class
 * @property {HistoryItem[]} array - The array of history of work events.
 * @property {string} loadedFile - The history JSON file or local storage key that was last loaded.
 */
export class History {
    /**
     * Create a new History object.
     * @param {Date} date - The date to load the history from if not provided use current.
     */
    constructor(date) {
        if (date instanceof Date === false && date !== undefined) {
            throw new Error('Date must be a Date object or undefined')
        }
        this.loadFromFile(date)
    }

    /**
     * Adds an item to the history.
     * @param {HistoryItem|'enter'|'exit'} item
     */
    add(item) {
        if (item instanceof HistoryItem === false &&
            item instanceof string === false) {
            throw new Error('Item must be a HistoryItem or a string')
        }
        if (typeof item === 'string') {
            item = new HistoryItem(item)
        }
        if (this.loadedFile !== getCurrentYearMonth()) {
            console.log('Started a new month. Loading new history file...')
            this.loadFromFile()
        }
    
        this.array.push(item)
        this.sortByTimeAsc()
        this.saveToFile()
    }

    /**
     * Save the history to a JSON file or local storage.
     * @private
     * @returns {void}
     */
    saveToFile() {
        const yearMonth = getCurrentYearMonth()
        const data = JSON.stringify(this.array)
        if (isClient) {
            localStorage.setItem(`history-${yearMonth}`, data)
        } else {
            fs.writeFileSync(__dirname + `/db/history-${yearMonth}.json`, data)
        }
    }

    /**
     * Load the history from a JSON file or local storage.
     * @private
     * @param {Date} date - The date to load the history from if not provided use current.
     * @returns {void}
     */
    loadFromFile(date) {
        if (date instanceof Date === false && date !== undefined) {
            throw new Error('Date must be a Date object or undefined')
        }
        const yearMonth = date ? dateToYearMonthString(date) : getCurrentYearMonth()
        try {
            let data
            if (isClient) {
                data = localStorage.getItem(`history-${yearMonth}`)
                if (!data) throw new Error('No data found in local storage')
            } else {
                data = fs.readFileSync(__dirname + `/db/history-${yearMonth}.json`, 'utf8')
            }
            this.loadedFile = yearMonth
            this.array = JSON.parse(data).map(entry => new HistoryItem(entry.type, new Date(entry.time)))
            this.sortByTimeAsc()
            console.log(`Loaded history from ${yearMonth}`)
        } catch (err) {
            if (isClient || err.code != 'ENOENT') { throw err } // Throw error if it's not a file not found error
            console.log(`No history file found for ${yearMonth}. Creating a new obj...`)
            this.loadedFile = yearMonth
            this.array = []
        }
    }

    /**
     * Check if a date is loaded.
     * @param {Date} date date to check if loaded, based on year and month
     * @returns {boolean} true if the date is loaded, false otherwise
     */
    isDateLoaded(date) {
        return this.loadedFile === dateToYearMonthString(date)
    }

    /**
     * Check if a time is in the history.
     * @param {Date} time - The time to check.
     * @returns {boolean} true if the time is in the history, false otherwise.
     */
    isTimeInHistory(time) {
        return this.array.some(entry => entry.time.getTime() === time.getTime())
    }

    /**
     * Get the length of the history.
     * @returns {number} The number of events in the history.
     * @readonly
     */
    get length() {
        return this.array.length
    }

    /**
     * Get the last item in the history.
     * @returns {HistoryItem} The last item in the history.
     * @readonly
     */
    get last() {
        return this.array.length > 0 ? this.array[this.array.length - 1] : null
    }

    /**
     * Get the first item in the history.
     * @returns {HistoryItem} The first item in the history.
     * @readonly
     */
    get first() {
        return this.array.length > 0 ? this.array[0] : null
    }

    /**
     * Check if the history is empty.
     * @returns {boolean} true if the history is empty, false otherwise.
     * @readonly
     */
    get isEmpty() {
        return this.array.length === 0
    }

    /**
     * Sort the history by time in ascending order.
     * @returns {void}
     */
    sortByTimeAsc() {
        this.array.sort((a, b) => a.time - b.time)
    }

    /**
     * Find the first event after a given time.
     * @param {Date} time - The time to find the first event after.
     * @returns {HistoryItem} The first event after the given time.
     */
    firstEventAfter(time) {
        return this.array.find(entry => entry.time > time)
    }

    /**
     * Find the first event before a given time.
     * @param {Date} time - The time to find the first event before.
     * @returns {HistoryItem} The first event before the given time.
     */
    firstEventBefore(time) {
        return this.array.reverse().find(entry => entry.time < time)
    }
}

/**
 * HistoryItem is a class that represents an event in work history.
 * @class
 * @property {Date} time - The time the event occurred.
 * @property {'enter'|'exit'} type - The type of event that occurred.
 */
export class HistoryItem {
    /**
     * Create a new HistoryItem.
     * @param {'enter'|'exit'} type - The type of event that occurred.
     * @param {Date} time - The time the event occurred - optional, defaults to current time.
     */
    constructor(type, time) {
        this.time = time || new Date()
        if (type !== 'enter' && type !== 'exit') {
            throw new Error('Type must be "enter" or "exit"')
        }
        this.type = type
    }
}

/**
 * returns the current date in the format 'YYYY-MM' for database file naming
 * @returns {String} 'YYYY-MM' of the current date
 */
function getCurrentYearMonth() {
    const date = new Date()
    return dateToYearMonthString(date)
}

/**
 * converts a Date object to a string in the format 'YYYY-MM' for database file naming
 * @param {Date} date 
 * @returns {String} 'YYYY-MM'
 */
function dateToYearMonthString(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}` // Month is 0-indexed
}