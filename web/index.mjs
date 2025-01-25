import express from 'express'
import bodyParser from 'body-parser'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { History, HistoryItem } from './History.mjs'
import crypto from 'crypto'

const app = express()
app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded
const port = 8097

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

if (!fs.existsSync(__dirname + '/db')) {
    fs.mkdirSync(__dirname + '/db')
    console.log('Created missing db folder')
}

let history = new History()

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/client/home.html')
})

app.use('/', express.static(__dirname + '/client'))
app.use('/js/History.mjs', express.static(__dirname + '/History.mjs'))

function handleEvent(req, res, eventType) {
    // override time with the time sent in the request (for sync), or use the current time
    const time = new Date(req?.body?.time || new Date())
    if (history.isTimeInHistory(time)) {
        return res.status(422).send('Time already exists in history')
    }

    // if first entry, just push it to the history
    // TODO edge cases for previous month/next month
    if (history.isEmpty) {
        history.add(new HistoryItem(eventType, time))
        return res.sendStatus(200)
    }

    // events might sync from remote client, this is the logic to handle all cases
    const firstEvent = history.first
    const lastEvent = history.last
    if (time < firstEvent.time && firstEvent.type !== eventType) {
        const prevMonth = new Date(history.loadedFile)
        prevMonth.setMonth(prevMonth.getMonth() - 1)
        const prevMonthDb = new History(prevMonth)
        const lastEventPrevMonth = prevMonthDb.last
        if (lastEventPrevMonth?.type !== eventType) { history.add(new HistoryItem(eventType, time)) }
        return res.sendStatus(200)
    } else if (time < firstEvent.time && firstEvent.type === eventType) {
        // refactor into History class
        history.array[0] = new HistoryItem(eventType, time)
        history.sortByTimeAsc()
        history.saveToFile()
        return res.sendStatus(200)
    } else if (time > lastEvent.time && lastEvent.type !== eventType) {
        history.add(new HistoryItem(eventType, time))
        return res.sendStatus(200)
    } else if (time > lastEvent.time && lastEvent.type === eventType) {
        return res.sendStatus(200)
    } else {
        // time is between two events
        const nextEvent = history.firstEventAfter(time)
        const previousEvent = history.firstEventBefore(time)
        if (previousEvent.type === eventType) {
            return res.sendStatus(200)
        }
        // prior event is an opposite type
        if (nextEvent.type !== eventType) {
            history.add(new HistoryItem(eventType, time))
            return res.sendStatus(200)
        } else {
            // next event is also the same type, replace it as the time is earlier
            // refactor into History class, similar to first event case where next is same type
            nextEvent.time = time
            history.sortByTimeAsc()
            history.saveToFile()
            return res.sendStatus(200)
        }
    }
}

app.post('/api/enter', (req, res) => handleEvent(req, res, 'enter'))

app.post('/api/exit', (req, res) => handleEvent(req, res, 'exit'))

app.get('/api/sessionTime', (req, res) => {
    const sessionTime = history.dailyTime()
    const isAtWork = history.isAtWork()
    res.send({ sessionTime, isAtWork })
})

function sendHistoryWithETag(res, historyArray, req) {
    const historyData = JSON.stringify(historyArray)
    const etag = crypto.createHash('md5').update(historyData).digest('hex')
    if (req.headers['if-none-match'] === etag) {
        return res.sendStatus(304)
    }
    res.setHeader('ETag', etag)
    return res.send({ history: historyArray })
}

app.get('/api/history', (req, res) => {
    if (req.query.year && req.query.month) {
        req.query.year = parseInt(req.query.year)
        req.query.month = parseInt(req.query.month)
        const date = new Date(req.query.year, req.query.month - 1)
        if (history.isDateLoaded(date)) {
            if (history.isEmpty) {
                return res.status(204).send('No Content')
            }
            return sendHistoryWithETag(res, history.array, req)
        }
        const oldHistory = new History(date)
        if (oldHistory.isEmpty) {
            return res.status(204).send('No Content')
        }
        return sendHistoryWithETag(res, oldHistory.array, req)
    } else if (req.query.year) {
        return res.status(400).send('Missing month parameter')
    } else if (req.query.month) {
        return res.status(400).send('Missing year parameter')
    } else {
        if (history.isEmpty) {
            return res.status(204).send('No Content')
        }
        return sendHistoryWithETag(res, history.array, req)
    }
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})