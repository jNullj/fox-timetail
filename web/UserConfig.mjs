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
            const response = await fetch(UserConfig.API_ENDPOINT)
            this.config = await response.json()
        } else {
            this.config = JSON.parse(fs.readFileSync(__dirname + '/' + UserConfig.BASE_FILE_NAME, 'utf8'))
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
        } else {
            fs.writeFileSync(__dirname + '/' + UserConfig.BASE_FILE_NAME, JSON.stringify(this.config, null, 4))
        }
    }
}