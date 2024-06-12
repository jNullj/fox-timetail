/**
 * This is a module with utility functions for working with the work time history.
 * @module history_utils
 */

/**
 * Calculates the time spent at work for a given date
 * @param {Array} history the history of work time entries
 * @param {Date} date the date to calculate the time spent at work
 * @returns {Date} the time spent at work
 */
export function calculateDailyTime(history, date) {
    const targetDate = date.toLocaleDateString();
    const targetDayHistory = history.filter(entry => entry.time.toLocaleDateString() === targetDate);
    targetDayHistory.sort((a, b) => a.time - b.time);
    let sessionTime = 0;
    let enterHistory = targetDayHistory.filter(entry => entry.type === 'enter').map(entry => entry.time);
    let exitHistory = targetDayHistory.filter(entry => entry.type === 'exit').map(entry => entry.time);

    for (let i = 0; i < exitHistory.length; i++) {
        sessionTime += exitHistory[i] - enterHistory[i];
    }
    if (enterHistory.length > exitHistory.length) {
        sessionTime += new Date() - enterHistory[enterHistory.length - 1];
    }
    return new Date(sessionTime);
}

/**
 * Checks if currently at work
 * @param {Array} history the history of work time entries
 * @returns {boolean} true if currently at work, false otherwise
 */
export function isCurrentlyAtWork(history) {
    const targetDate = new Date().toLocaleDateString();
    const targetDayHistory = history.filter(entry => entry.time.toLocaleDateString() === targetDate);
    let enterHistory = targetDayHistory.filter(entry => entry.type === 'enter').map(entry => entry.time);
    let exitHistory = targetDayHistory.filter(entry => entry.type === 'exit').map(entry => entry.time);

    return enterHistory.length > exitHistory.length;
}

/**
 * JSON to history object
 * @param {Object} json the JSON object to convert
 * @returns {Array} the history object
 */
export function jsonToHistory(json) {
    return json.map(entry => {
        entry.time = new Date(entry.time)
        return entry
    })
}