const isClient = typeof window !== 'undefined'

let fs, __filename, __dirname

if (!isClient) {
    fs = await import('fs')
    const dirname = (await import('path')).dirname
    const fileURLToPath = (await import('url')).fileURLToPath

    __filename = fileURLToPath(import.meta.url)
    __dirname = dirname(__filename)
}

/**
 * History is a class that represents a history of work events.
 * @class
 * @property {HistoryItem[]} array - The array of history of work events.
 * @property {string} loadedFile - The history JSON file or local storage key that was last loaded.
 */
export class History {
    /**
     * Create a new History object.
     * @param {Date} [date] - The date to load the history from if not provided use current.
     * @param {string} [data] - The serialized history data. If provided, it will be used instead of loading from file.
     */
    constructor(date, data) {
        if (date && !(date instanceof Date)) {
            throw new Error('Date must be a Date object')
        }
        if (data && date) {
            this.deserialize(data)
            this.loadedFile = dateToYearMonthString(date)
        } else {
            this.loadFromFile(date)
        }
    }

    /**
     * Adds an item to the history.
     * @param {HistoryItem|'enter'|'exit'} item
     */
    add(item) {
        if (item instanceof HistoryItem === false &&
            item !== 'enter' && item !== 'exit' && item !== 'sick') {
            throw new Error('Item must be a HistoryItem or a fitting string')
        }
        if (typeof item === 'string') {
            item = new HistoryItem(item)
        }
        if (this.loadedFile !== getCurrentYearMonth()) {
            // TODO: add support for adding to previous months
            console.log('Started a new month. Loading new history file...')
            this.loadFromFile()
        }
    
        this.array.push(item)
        this.sortByTimeAsc()
        this.saveToFile()
    }

    /**
     * Serialize the history data.
     * @private
     * @returns {string} The history data in JSON format.
     */
    serialize() {
        return JSON.stringify(this.array)
    }

    /**
     * Save the history to a JSON file or local storage.
     * @private
     * @returns {void}
     */
    saveToFile() {
        const yearMonth = this.loadedFile || getCurrentYearMonth()
        const data = this.serialize()
        if (isClient) {
            localStorage.setItem(`history-${yearMonth}`, data)
        } else {
            fs.writeFileSync(__dirname + `/db/history-${yearMonth}.json`, data)
        }
    }

    /**
     * Deserialize the history data.
     * @private
     * @param {string|object} data - The history data in JSON format string or object.
     * @returns {void}
     */
    deserialize(data) {
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data
        this.array = parsedData.map(entry => new HistoryItem(entry.type, new Date(entry.time)))
        this.sortByTimeAsc()
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
            this.deserialize(data)
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
     * Check if a sick event exists for a particular date (compares by day).
     * @param {Date} date - The date to check. Defaults to today.
     * @returns {boolean} true if a sick event exists on that date.
     */
    hasSickDay(date) {
        if (!date) date = new Date()
        return this.array.some(entry => entry.type === 'sick' && entry.time.toDateString() === date.toDateString())
    }

    /**
     * Remove all sick events for a particular date (compares by day).
     * Saves the history file if any entries were removed.
     * @param {Date} date - The date to remove sick events for. Defaults to today.
     * @returns {boolean} true if any sick events were removed, false otherwise.
     */
    removeSickDay(date) {
        if (!date) date = new Date()
        const originalLength = this.array.length
        this.array = this.array.filter(entry => !(entry.type === 'sick' && entry.time.toDateString() === date.toDateString()))
        if (this.array.length !== originalLength) {
            this.sortByTimeAsc()
            this.saveToFile()
            return true
        }
        return false
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

    /**
     * Check if currently at work.
     * @returns {boolean} true if currently at work, false otherwise
     */
    isAtWork() {
        if (this.isEmpty) {
            return false // todo: handle loading old month for edge case, with timeout or read file for earliest entry
        }
        if (this.loadedFile !== getCurrentYearMonth()) {
            return false
        }
        return this.last.type === 'enter'
    }

    /**
     * Returns the time spent at work for a given date.
     * @param {Date|undefined} date the date to calculate the time spent at work, defaults to today
     * @returns {Date} the time spent at work
     */
    dailyTime(date) {
        if (this.isEmpty) {
            return new Date(0)
        }
        if (!date) {
            date = new Date()
        }
        // Consider only enter/exit events for daily time calculation — ignore 'sick' events
        const entries = this.array.filter(entry => entry.time.toDateString() === date.toDateString() && (entry.type === 'enter' || entry.type === 'exit'))
        if (entries.length === 0) {
            return new Date(0)
        }
        if (entries.length % 2 !== 0) {
            entries.push(new HistoryItem('exit', new Date()))
        }
        let time = 0
        for (let i = 0; i < entries.length; i += 2) {
            time += entries[i + 1].time - entries[i].time
        }
        return new Date(time)
    }

    /**
     * Fetch a History object from the API.
     * @param {number} year - The year to fetch the history for.
     * @param {number} month - The month to fetch the history for.
     * @returns {Promise<History>} A promise that resolves to a History object.
     */
    static async fetchFromApi(year, month) {
        if (!isClient) {
            throw new Error('fetchFromApi is only available in the browser')
        }
        if (typeof year !== 'number' || typeof month !== 'number' || !Number.isInteger(year) || !Number.isInteger(month) || year < 0 || month < 1 || month > 12) {
            throw new Error('Invalid year or month format')
        }
        const date = new Date(year, month - 1)
        const yearMonth = dateToYearMonthString(date)
        const cachedData = localStorage.getItem(`history-${yearMonth}`)
        const headers = {}
        if (cachedData) {
            const etag = localStorage.getItem(`etag-${yearMonth}`)
            if (etag) {
                headers['If-None-Match'] = etag
            }
        }
        try {
            const response = await fetch(`/api/history?year=${year}&month=${month}`, { headers })
            if (response.status === 204) {
                return new History(date, [])
            }
            if (response.status === 304) {
                return new History(date, cachedData)
            }
            if (response.status === 503) {
                throw new Error('Service Unavailable')
            }
            const data = await response.json()
            const etag = response.headers.get('ETag')
            if (etag) {
                localStorage.setItem(`etag-${yearMonth}`, etag)
            }
            localStorage.setItem(`history-${yearMonth}`, JSON.stringify(data.history))
            return new History(date, data.history)
        } catch (error) {
            if (cachedData) {
                return new History(date, cachedData)
            }
            return new History(date, [])
        }
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
     * @param {'enter'|'exit'|'sick'} type - The type of event that occurred.
     * @param {Date} time - The time the event occurred - optional, defaults to current time.
     */
    constructor(type, time) {
        this.time = time || new Date()
        if (type !== 'enter' && type !== 'exit' && type !== 'sick') {
            throw new Error('Type must be "enter", "exit", or "sick"')
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