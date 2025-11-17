// modules/Debug.js: Konsistentes Logging-Modul (jetzt auch mit HTML-Output)

const APP_NAME = "BLE_Dashboard";
const DEBUG_MODE = true; // Globaler Schalter für Logs

// HTML-Element für den Log-Output
let logOutputElement = null;

// Initialisiert das Modul und holt sich das DOM-Element
function initializeDebugUI() {
    // Diese Funktion wird bei DOMContentLoaded aufgerufen
    logOutputElement = document.getElementById('debug-log-output');
    const clearButton = document.getElementById('debug-clear-btn');
    
    // --- NEU: Defensive Prüfung ---
    // Verhindert einen Absturz, falls die HTML-Elemente
    // (z.B. durch Lade-Reihenfolge oder Copy-Paste-Fehler) nicht da sind.
    if (logOutputElement && clearButton) {
        clearButton.addEventListener('click', () => {
            logOutputElement.innerHTML = '';
        });
        Debug.log("On-Screen-Debugger UI initialisiert."); // Loggt jetzt in sich selbst
    } else if (DEBUG_MODE) {
        // Loggt nur in die (unsichtbare) Konsole, wenn die UI fehlt
        console.warn("Debug.js: On-Screen-Debug-UI-Elemente (output/clear) nicht im DOM gefunden.");
    }
}

// Stellt sicher, dass die UI bereit ist, bevor wir versuchen, hineinzuschreiben
document.addEventListener('DOMContentLoaded', initializeDebugUI);

/**
 * Schreibt eine Log-Nachricht in die Konsole und das HTML-Fenster.
 * @param {string} level - 'log', 'warn', 'error'
 * @param {string} message - Die Hauptnachricht
 * @param  {...any} optionalParams - Zusätzliche Daten (Objekte, Arrays etc.)
 */
function writeLog(level, message, ...optionalParams) {
    if (!DEBUG_MODE) return;

    const timestamp = new Date().toLocaleTimeString('de-DE');
    const fullMessage = `[${APP_NAME}] ${message}`;

    // 1. In die Browser-Konsole loggen
    console[level](fullMessage, ...optionalParams);

    // 2. In das HTML-Debug-Fenster loggen
    // Diese Prüfung ist jetzt doppelt sicher:
    // 1. Sie verhindert Logs, bevor DOMContentLoaded lief.
    // 2. Sie verhindert Logs, falls initializeDebugUI die Elemente nicht finden konnte.
    if (logOutputElement) {
        const logEntry = document.createElement('div');
        logEntry.className = `debug-entry debug-${level}`;
        
        // Hauptnachricht
        const msgElement = document.createElement('span');
        msgElement.textContent = `[${timestamp}] ${message} `;
        logEntry.appendChild(msgElement);

        // Optionale Parameter (als JSON)
        if (optionalParams.length > 0) {
            optionalParams.forEach(param => {
                const dataElement = document.createElement('pre');
                try {
                    // null, 2 = hübsche JSON-Formatierung
                    dataElement.textContent = JSON.stringify(param, null, 2);
                } catch (e) {
                    dataElement.textContent = "[Konnte Objekt nicht stringifizieren]";
                }
                logEntry.appendChild(dataElement);
            });
        }
        
        // Oben anfügen und scrollen
        logOutputElement.prepend(logEntry);
    }
}

export const Debug = {
    log: (message, ...optionalParams) => {
        writeLog('log', message, ...optionalParams);
    },
    
    warn: (message, ...optionalParams) => {
        writeLog('warn', message, ...optionalParams);
    },
    
    error: (message, error, ...optionalParams) => {
        // Error-Objekte für bessere Lesbarkeit behandeln
        let errorDetails = (error instanceof Error) ? `${error.name}: ${error.message}` : error;
        writeLog('error', `${message} -> ${errorDetails}`, ...optionalParams);
    }
};
