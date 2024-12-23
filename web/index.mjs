import express from 'express'
import bodyParser from 'body-parser'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { calculateDailyTime, isCurrentlyAtWork } from './history_utils.mjs'

const app = express()
app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded
const port = 8097
let history = []

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

if (!fs.existsSync(__dirname + '/db')) {
    fs.mkdirSync(__dirname + '/db')
    console.log('Created missing db folder')
}

/**
 * converts a Date object to a string in the format 'YYYY-MM' for database file naming
 * @param {Date} date 
 * @returns {String} 'YYYY-MM'
 */
function dateToYearMonthString(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}` // Month is 0-indexed
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
 * @param {Object} options         options object
 * @param {Date} options.oldDate   the date to load the history from
 * @returns {Array} history, empty if no file found
 */
function loadHistoryFromFile(options = {}) {
    const { oldDate } = options
    const yearMonth =  oldDate ? dateToYearMonthString(oldDate) : getCurrentYearMonth()
    try {
        const data = fs.readFileSync(__dirname + `/db/history-${yearMonth}.json`, 'utf8')
        if(!oldDate) { loadHistoryFromFile.lastLoaded = yearMonth }
        let parsedData = JSON.parse(data)
        parsedData.map(entry => entry.time = new Date(entry.time))
        if(!oldDate) { console.log(`Loaded history from ${yearMonth}`) }
        return parsedData
    } catch (err) {
        if (err.code != 'ENOENT') { throw err } // Throw error if it's not a file not found error
        if (!oldDate) {
            console.log(`No history file found for ${yearMonth}. Creating a new one...`)
            loadHistoryFromFile.lastLoaded = yearMonth
        }
        return []
    }
}
function saveHistoryToFile() {
    const yearMonth = getCurrentYearMonth()
    fs.writeFileSync(__dirname + `/db/history-${yearMonth}.json`, JSON.stringify(history))
}
function pushToHistory(event) {
    if (loadHistoryFromFile.lastLoaded !== getCurrentYearMonth()) {
        console.log('Started a new month. Loading new history file...')
        history = loadHistoryFromFile()
    }

    history.push(event)
    saveHistoryToFile()
}

history = loadHistoryFromFile()

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/home.html')
})
app.use('/home.html', express.static(__dirname + '/home.html'))
app.use('/css/home.css', express.static(__dirname + '/home.css'))
app.use('/js/home.js', express.static(__dirname + '/home.js'))
app.use('/js/history_utils.mjs', express.static(__dirname + '/history_utils.mjs'))
app.use('/js/historyModal.mjs', express.static(__dirname + '/historyModal.mjs'))
app.use('/js/modal.mjs', express.static(__dirname + '/modal.mjs'))
app.use('/icons', express.static(__dirname + '/icons'))
app.use('/manifest.json', express.static(__dirname + '/manifest.json'))
app.use('/serviceWorker.js', express.static(__dirname + '/serviceWorker.js'))

app.post('/api/enter', (req, res) => {
    // override time with the time sent in the request (for sync), or use the current time
    const time = new Date(req?.body?.time || new Date())
    if (history.some(entry => entry.time.getTime() === time.getTime())) {
        return res.status(422).send('Time already exists in history')
    }

    // if first entry, just push it to the history
    if (history.length < 1) {
        pushToHistory({ type: 'enter', time })
        return res.sendStatus(200)
    }

    // sort the history by time, from oldest to newest
    history.sort((a, b) => a.time - b.time)
    // events might sync from remote client, this is the logic to handle all cases
    // event before | event after | result
    // enter        | enter       | do nothing
    // enter        | exit        | do nothing
    // exit         | enter       | replace enter event
    // exit         | exit        | add event
    // none         | enter       | replace enter event
    // none         | exit        | add event
    // exit         | none        | add event
    // enter        | none        | do nothing
    const lastEvent = history[history.length - 1]
    const firstEvent = history[0]
    if (time < firstEvent.time && firstEvent.type === 'exit') {
        const prevMonth = new Date(loadHistoryFromFile.lastLoaded)
        prevMonth.setMonth(prevMonth.getMonth() - 1)
        const prevMonthDb = loadHistoryFromFile({oldDate: prevMonth})
        const lastEventPrevMonth = prevMonthDb[prevMonthDb.length - 1]
        if(lastEventPrevMonth?.type !== 'enter') { pushToHistory({ type: 'enter', time }) }
        return res.sendStatus(200)
    }else if (time < firstEvent.time && firstEvent.type === 'enter') {
        history[0] = { type: 'enter', time }
        return res.sendStatus(200)
    }else if (time > lastEvent.time && lastEvent.type === 'exit') {
        pushToHistory({ type: 'enter', time })
        return res.sendStatus(200)
    }else if (time > lastEvent.time && lastEvent.type === 'enter') {
        return res.sendStatus(200)
    }else{
        // time is between two events
        const nextEvent = history.find((entry, index) => entry.time > time && history[index - 1].time < time)
        const previousEvent = history.find((entry, index) => entry.time < time && history[index + 1].time > time)
        if (previousEvent.type === 'enter') {
            return res.sendStatus(200)
        }
        // prior event is an exit
        if (nextEvent.type === 'exit') {
            pushToHistory({ type: 'enter', time })
            return res.sendStatus(200)
        }else{
            history[history.indexOf(nextEvent)] = { type: 'enter', time }
            return res.sendStatus(200)
        }
    }
})

app.post('/api/exit', (req, res) => {
    // override time with the time sent in the request (for sync), or use the current time
    const time = new Date(req?.body?.time || new Date())
    if (history.some(entry => entry.time.getTime() === time.getTime())) {
        return res.status(422).send('Time already exists in history')
    }

    // if first entry, just push it to the history
    if (history.length < 1) {
        pushToHistory({ type: 'exit', time })
        return res.sendStatus(200)
    }

    // sort the history by time, from oldest to newest
    history.sort((a, b) => a.time - b.time)
    // events might sync from remote client, this is the logic to handle all cases
    // event before | event after | result
    // exit         | exit        | do nothing
    // exit         | enter       | do nothing
    // enter        | exit        | replace exit event
    // enter        | enter       | add event
    // none         | exit        | replace exit event (if prev month fits)
    // none         | enter       | add event (if prev month fits)
    // enter        | none        | add event
    // exit         | none        | do nothing
    const firstEvent = history[0]
    const lastEvent = history[history.length - 1]
    if (time < firstEvent.time && firstEvent.type === 'enter') {
        const prevMonth = new Date(loadHistoryFromFile.lastLoaded)
        prevMonth.setMonth(prevMonth.getMonth() - 1)
        const prevMonthDb = loadHistoryFromFile({oldDate: prevMonth})
        const lastEventPrevMonth = prevMonthDb[prevMonthDb.length - 1]
        if(lastEventPrevMonth?.type !== 'exit') { pushToHistory({ type: 'exit', time }) }
        return res.sendStatus(200)
    }else if (time < firstEvent.time && firstEvent.type === 'exit') {
        history[0] = { type: 'exit', time }
        return res.sendStatus(200)
    }else if (time > lastEvent.time && lastEvent.type === 'enter') {
        pushToHistory({ type: 'exit', time })
        return res.sendStatus(200)
    }else if (time > lastEvent.time && lastEvent.type === 'exit') {
        return res.sendStatus(200)
    }else{
        // time is between two events
        const nextEvent = history.find((entry, index) => entry.time > time && history[index - 1].time < time)
        const previousEvent = history.find((entry, index) => entry.time < time && history[index + 1].time > time)
        if (previousEvent.type === 'exit') {
            return res.sendStatus(200)
        }
        // prior event is an enter
        if (nextEvent.type === 'enter') {
            pushToHistory({ type: 'exit', time })
            return res.sendStatus(200)
        }else{
            history[history.indexOf(nextEvent)] = { type: 'exit', time }
            return res.sendStatus(200)
        }
    }
})

app.get('/api/sessionTime', (req, res) => {
    const sessionTime = calculateDailyTime(history, new Date())
    const isAtWork = isCurrentlyAtWork(history)
    res.send({ sessionTime, isAtWork })
})

app.get('/api/history', (req, res) => {
    if (req.query.year && req.query.month) {
        req.query.year = parseInt(req.query.year)
        req.query.month = parseInt(req.query.month)
        const date = new Date(req.query.year, req.query.month - 1)
        if (date > new Date()) {
            // loadHistoryFromFile is not built for future dates, TODO in history as obj refactor
            return res.send({ history: [] })
        }
        if (dateToYearMonthString(date) === loadHistoryFromFile.lastLoaded) {
            // avoid the file load, its already loaded
            return res.send({ history })
        }
        const oldHistory = loadHistoryFromFile({ oldDate: date })
        return res.send({ history: oldHistory })
    } else if (req.query.year) {
        return res.status(400).send('Missing month parameter')
    } else if (req.query.month) {
        return res.status(400).send('Missing year parameter')
    } else {
        return res.send({ history })
    }
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})