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

function handleDayToggle(req, res, type) {
    try {
        const body = req.body || {}
        const state = body.state === undefined ? true : Boolean(body.state)
        const time = body.time ? new Date(body.time) : new Date()

        // If the time is invalid
        if (isNaN(time.getTime())) {
            return res.status(400).send('Invalid time')
        }

        // Target history: may be previous month
        let targetHistory
        if (history.isDateLoaded(time)) {
            targetHistory = history
        } else {
            targetHistory = new History(time)
        }

        let hasFn, removeFn, addType
        switch (type) {
            case 'sick':
                hasFn = (h, d) => h.hasSickDay(d)
                removeFn = (h, d) => h.removeSickDay(d)
                addType = 'sick'
                break
            case 'vacation':
                hasFn = (h, d) => h.hasVacationDay(d)
                removeFn = (h, d) => h.removeVacationDay(d)
                addType = 'vacation'
                break
            default:
                return res.status(400).send('Invalid type')
        }

        if (state) {
            const existing = targetHistory.getDayModifier(time)

            // Identical modifier already set: ignore
            if (existing === addType) {
                return res.sendStatus(200)
            }

            // No modifier set: add the requested one
            if (!existing) {
                targetHistory.add(new HistoryItem(addType, time))
                return res.sendStatus(200)
            }

            // Different modifier exists: allow client to request replacement via `replace` flag
            if (body.replace) {
                targetHistory.removeModifier(time)
                targetHistory.add(new HistoryItem(addType, time))
                return res.sendStatus(200)
            }

            return res.status(409).send({ conflict: existing })
        } else {
            removeFn(targetHistory, time)
            return res.sendStatus(200)
        }
    } catch (err) {
        console.error(err)
        return res.status(500).send(`Failed to update ${type} day`)
    }
}

app.post('/api/sick', (req, res) => handleDayToggle(req, res, 'sick'))

app.post('/api/vacation', (req, res) => handleDayToggle(req, res, 'vacation'))

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

// Endpoint to import a month's history using a JSON object
app.post('/api/importMonth', (req, res) => {
    const { year, month, data } = req.body

    if (!year || !month || !data) {
        return res.status(400).send('Year, month, and data are required')
    }

    const yearInt = parseInt(year)
    const monthInt = parseInt(month)

    if (!Number.isInteger(yearInt) || !Number.isInteger(monthInt) || yearInt < 0 || monthInt < 1 || monthInt > 12) {
        return res.status(400).send('Invalid year or month')
    }

    try {
        if (!Array.isArray(data)) {
            return res.status(400).send('Invalid data format: Expected an array of history items')
        }

        // Use the existing history instance if the month matches
        const importDate = new Date(yearInt, monthInt - 1)
        let targetHistory
        if (history.isDateLoaded(importDate)) {
            targetHistory = history
        } else {
            targetHistory = new History(importDate)
        }

        // Compare arrays by stringifying (order matters) - optimize to avoid write when identical
        const importedString = JSON.stringify(data)
        const currentString = JSON.stringify(targetHistory.array.map(item => ({ type: item.type, time: item.time.toISOString() })))

        // If different, overwrite
        if (importedString !== currentString) {
            targetHistory.deserialize(data)
            targetHistory.saveToFile()
            console.log(`History imported successfully for ${yearInt}-${monthInt}`)
            console.log(`array: ${JSON.stringify(targetHistory.array)}`)
            return res.status(200).send('History imported and overwritten')
        } else {
            return res.status(200).send('Imported history is identical to current, no changes made')
        }
    } catch (error) {
        console.error(error)
        return res.status(500).send('An error occurred while processing the data')
    }
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})