export class Modal {
    constructor(parent) {
        this.parent = parent || document.body
        this.modal = document.createElement('div')
        this.modal.className = 'modal'

        this.content = document.createElement('div')
        this.content.className = 'modal-content'
        this.modal.appendChild(this.content)

        this.closeButton = document.createElement('span')
        this.closeButton.className = 'closeButton'
        this.closeButton.innerHTML = '&times;'
        this.closeButton.addEventListener('click', () => {
            this.close()
        })
        this.modal.appendChild(this.closeButton)

        parent.appendChild(this.modal)
    }

    close() {
        this.modal.style.display = 'none'
    }

    show() {
        this.modal.style.display = 'flex'
    }
}