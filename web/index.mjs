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
    res.sendFile(__dirname + '/home.html')
})
app.use('/home.html', express.static(__dirname + '/home.html'))
app.use('/css/home.css', express.static(__dirname + '/home.css'))
app.use('/js/home.js', express.static(__dirname + '/home.js'))
app.use('/js/historyModal.mjs', express.static(__dirname + '/historyModal.mjs'))
app.use('/js/History.mjs', express.static(__dirname + '/History.mjs'))
app.use('/js/modal.mjs', express.static(__dirname + '/modal.mjs'))
app.use('/icons', express.static(__dirname + '/icons'))
app.use('/manifest.json', express.static(__dirname + '/manifest.json'))
app.use('/serviceWorker.js', express.static(__dirname + '/serviceWorker.js'))

app.post('/api/enter', (req, res) => {
    // override time with the time sent in the request (for sync), or use the current time
    const time = new Date(req?.body?.time || new Date())
    if (history.isTimeInHistory(time)) {
        return res.status(422).send('Time already exists in history')
    }

    // if first entry, just push it to the history
    if (history.isEmpty) {
        history.add(new HistoryItem('enter', time))
        return res.sendStatus(200)
    }

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
    const lastEvent = history.last
    const firstEvent = history.first
    if (time < firstEvent.time && firstEvent.type === 'exit') {
        const prevMonth = new Date(history.loadedFile)
        prevMonth.setMonth(prevMonth.getMonth() - 1)
        const prevMonthDb = new History(prevMonth)
        const lastEventPrevMonth = prevMonthDb.last
        if(lastEventPrevMonth?.type !== 'enter') { history.add(new HistoryItem('enter', time)) }
        return res.sendStatus(200)
    }else if (time < firstEvent.time && firstEvent.type === 'enter') {
        history.array[0] = new HistoryItem('enter', time)
        return res.sendStatus(200)
    }else if (time > lastEvent.time && lastEvent.type === 'exit') {
        history.add(new HistoryItem('enter', time))
        return res.sendStatus(200)
    }else if (time > lastEvent.time && lastEvent.type === 'enter') {
        return res.sendStatus(200)
    }else{
        // time is between two events
        const nextEvent = history.firstEventAfter(time)
        const previousEvent = history.firstEventBefore(time)
        if (previousEvent.type === 'enter') {
            return res.sendStatus(200)
        }
        // prior event is an exit
        if (nextEvent.type === 'exit') {
            history.add(new HistoryItem('enter', time))
            return res.sendStatus(200)
        }else{
            // next event is also enter, replace it as entrance time is earlier
            // TODO REFACTOR EVERYTHING HERE INTO HISTORY CLASS
            nextEvent.time = time
            return res.sendStatus(200)
        }
    }
})

app.post('/api/exit', (req, res) => {
    // override time with the time sent in the request (for sync), or use the current time
    const time = new Date(req?.body?.time || new Date())
    if (history.isTimeInHistory(time)) {
        return res.status(422).send('Time already exists in history')
    }

    // if first entry, just push it to the history
    if (history.isEmpty) {
        history.add(new HistoryItem('exit', time))
        return res.sendStatus(200)
    }

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
    const firstEvent = history.first
    const lastEvent = history.last
    if (time < firstEvent.time && firstEvent.type === 'enter') {
        const prevMonth = new Date(history.loadedFile)
        prevMonth.setMonth(prevMonth.getMonth() - 1)
        const prevMonthDb = new History(prevMonth)
        const lastEventPrevMonth = prevMonthDb.last
        if(lastEventPrevMonth?.type !== 'exit') { history.add(new HistoryItem('exit', time)) }
        return res.sendStatus(200)
    }else if (time < firstEvent.time && firstEvent.type === 'exit') {
        history.array[0] = new HistoryItem('exit', time)
        return res.sendStatus(200)
    }else if (time > lastEvent.time && lastEvent.type === 'enter') {
        history.add(new HistoryItem('exit', time))
        return res.sendStatus(200)
    }else if (time > lastEvent.time && lastEvent.type === 'exit') {
        return res.sendStatus(200)
    }else{
        // time is between two events
        const nextEvent = history.firstEventAfter(time)
        const previousEvent = history.firstEventBefore(time)
        if (previousEvent.type === 'exit') {
            return res.sendStatus(200)
        }
        // prior event is an enter
        if (nextEvent.type === 'enter') {
            history.add(new HistoryItem('exit', time))
            return res.sendStatus(200)
        }else{
            // next event is also exit, replace it as exit time is earlier
            // TODO REFACTOR EVERYTHING HERE INTO HISTORY CLASS
            nextEvent.time = time
            return res.sendStatus(200)
        }
    }
})

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
            return sendHistoryWithETag(res, history.array, req)
        }
        const oldHistory = new History(date)
        return sendHistoryWithETag(res, oldHistory.array, req)
    } else if (req.query.year) {
        return res.status(400).send('Missing month parameter')
    } else if (req.query.month) {
        return res.status(400).send('Missing year parameter')
    } else {
        return sendHistoryWithETag(res, history.array, req)
    }
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})