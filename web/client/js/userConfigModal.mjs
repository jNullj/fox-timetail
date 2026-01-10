import { Modal } from "./modal.mjs"
import { UserConfig } from "./UserConfig.mjs"

export class userConfigModal extends Modal {
    constructor(parent) {
        super(parent)
        this.createForm()
        this.init()
    }

    async init() {
        this.userConfig = new UserConfig()
        try {
            await this.userConfig.load()
        } catch (err) {
            console.warn('Could not load user config:', err)
        }
        this.buildFields()
        this.form.addEventListener('submit', (e) => this.onSubmit(e))
    }

    createForm() {
        this.form = document.createElement('form')
        this.content.appendChild(this.form)
    }

    buildFields() {
        const cfg = (this.userConfig && this.userConfig.config) ? this.userConfig.config : {}
        this.form.innerHTML = ''

        this.addField('dailyWorkHours', 'number', cfg.dailyWorkHours)
        this.addField('sickDaysMonthlyRate', 'number', cfg.sickDaysMonthlyRate)
        this.addField('vacationDaysMonthlyRate', 'number', cfg.vacationDaysMonthlyRate)

        this.addTextareaField('breaks', 'Breaks (JSON array)', JSON.stringify(cfg.breaks || [], null, 2))
        this.addTextareaField('holidays', 'Holidays (one per line)', (cfg.holidays || []).join('\n'))
        this.addWeekdaysField('workingDays', (cfg.workingDays || []))

        const actions = document.createElement('div')
        actions.classList.add('uc-actions')
        const submit = document.createElement('button')
        submit.type = 'submit'
        submit.textContent = 'Save'
        actions.appendChild(submit)
        this.form.appendChild(actions)
    }

    addField(name, type, value) {
        const label = document.createElement('label')
        label.textContent = name
        label.classList.add('uc-label')
        const input = document.createElement('input')
        input.type = type
        if (type === 'number') input.step = 'any'
        input.name = name
        if (value !== undefined && value !== null) input.value = value
        input.classList.add('uc-input')
        label.appendChild(input)
        this.form.appendChild(label)
    }

    addTextareaField(name, labelText, value) {
        const label = document.createElement('label')
        label.textContent = labelText
        label.classList.add('uc-label')
        const ta = document.createElement('textarea')
        ta.name = name
        ta.rows = 4
        ta.cols = 40
        if (value !== undefined && value !== null) ta.value = value
        ta.classList.add('uc-textarea')
        label.appendChild(ta)
        this.form.appendChild(label)
    }

    addWeekdaysField(name, selectedArray) {
        const days = [
            { short: 'S', full: 'Sun' },
            { short: 'M', full: 'Mon' },
            { short: 'T', full: 'Tue' },
            { short: 'W', full: 'Wed' },
            { short: 'T', full: 'Thu' },
            { short: 'F', full: 'Fri' },
            { short: 'S', full: 'Sat' }
        ]

        const containerLabel = document.createElement('label')
        containerLabel.textContent = name
        containerLabel.classList.add('uc-label')

        const container = document.createElement('div')
        container.classList.add('uc-weekdays')

        days.forEach(d => {
            const btn = document.createElement('button')
            btn.type = 'button'
            btn.classList.add('uc-weekday')
            btn.textContent = d.short
            btn.dataset.day = d.full
            btn.title = d.full
            if (selectedArray && selectedArray.includes(d.full)) {
                btn.classList.add('selected')
                btn.setAttribute('aria-pressed', 'true')
            } else {
                btn.setAttribute('aria-pressed', 'false')
            }
            btn.addEventListener('click', () => {
                const isSelected = btn.classList.toggle('selected')
                btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false')
            })
            container.appendChild(btn)
        })

        containerLabel.appendChild(container)
        this.form.appendChild(containerLabel)
    }

    async onSubmit(e) {
        e.preventDefault()
        const f = new FormData(this.form)
        const cfg = this.userConfig.config || {}
        cfg.dailyWorkHours = Number(f.get('dailyWorkHours')) || 0
        cfg.sickDaysMonthlyRate = Number(f.get('sickDaysMonthlyRate')) || 0
        cfg.vacationDaysMonthlyRate = Number(f.get('vacationDaysMonthlyRate')) || 0

        // parse breaks as JSON
        const breaksField = this.form.querySelector('[name="breaks"]')
        if (breaksField) {
            try {
                cfg.breaks = JSON.parse(breaksField.value || '[]')
            } catch (err) {
                alert('Could not parse breaks JSON: ' + err.message)
                return
            }
        }

        const holidaysField = this.form.querySelector('[name="holidays"]')
        if (holidaysField) {
            cfg.holidays = holidaysField.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
        }

        // read working days from weekday buttons
        const weekdayButtons = this.form.querySelectorAll('.uc-weekday.selected')
        if (weekdayButtons && weekdayButtons.length > 0) {
            cfg.workingDays = Array.from(weekdayButtons).map(b => b.dataset.day)
        } else {
            cfg.workingDays = []
        }

        try {
            await this.userConfig.save()
            const successMsg = document.createElement('div')
            successMsg.textContent = 'Configuration saved.'
            successMsg.classList.add('uc-success')
            this.content.appendChild(successMsg)
        } catch (err) {
            alert('Failed to save configuration: ' + err.message)
        }
    }

}