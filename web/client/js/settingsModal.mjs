import { Modal } from './modal.mjs'

export class SettingsModal extends Modal {
    constructor(parent) {
        super(parent)
        this.createButtonFlexbox()
    }

    createButtonFlexbox() {
        this.buttonGrid = document.createElement('div')
        this.buttonGrid.className = 'settings-flexbox'
        this.content.appendChild(this.buttonGrid)
    }

    addButton(icon, text, onClick) {
        const button = document.createElement('div')
        button.className = 'grid-item'
        button.innerHTML = `
            <img src="${icon}" alt="${text}">
            <span>${text}</span>
        `
        button.addEventListener('click', onClick)
        this.buttonGrid.appendChild(button)
    }
}
