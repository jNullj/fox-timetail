const isClient = typeof window !== 'undefined'

let fs, __filename, __dirname

if (!isClient) {
    fs = await import('fs')
    const dirname = (await import('path')).dirname
    const fileURLToPath = (await import('url')).fileURLToPath

    __filename = fileURLToPath(import.meta.url)
    __dirname = dirname(__filename)
}

export class UserConfig {
    static API_ENDPOINT = '/api/config'
    static BASE_FILE_NAME = 'config.json'

    constructor() {
        this.config = {}
        this.config.breaks = []
        this.config.dailyWorkHours = 8
        this.config.sickDaysMonthlyRate = 8
        this.config.vacationDaysMonthlyRate = 8
        this.config.holidays = []
        this.config.workingDays = []
    }

    async load() {
        if (isClient) {
            try {
                const response = await fetch(UserConfig.API_ENDPOINT)
                if (!response.ok) throw new Error('Network response was not ok')
                this.config = await response.json()
                localStorage.setItem(UserConfig.BASE_FILE_NAME, JSON.stringify(this.config))
            } catch (error) {
                if (error.message !== 'Network response was not ok') { throw error }
                const cachedData = localStorage.getItem(UserConfig.BASE_FILE_NAME)
                if (cachedData) {
                    this.config = JSON.parse(cachedData)
                } else {
                    throw new Error('no data available')
                }
            }
        } else {
            this.config = JSON.parse(fs.readFileSync(__dirname + '/db/' + UserConfig.BASE_FILE_NAME, 'utf8'))
        }
    }

    async save() {
        if (isClient) {
            await fetch(UserConfig.API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.config)
            })
            localStorage.setItem(UserConfig.BASE_FILE_NAME, JSON.stringify(this.config))
        } else {
            fs.writeFileSync(__dirname + '/db/' + UserConfig.BASE_FILE_NAME, JSON.stringify(this.config, null, 4))
        }
    }
}