// modules/Debug.js: Konsistentes Logging-Modul (jetzt mit HTML-Output)

const APP_NAME = "BLE_Dashboard";
const DEBUG_MODE = true; // Globaler Schalter für Logs

// HTML-Element für den Log-Output
let logOutputElement = null;

// --- GEÄNDERT ---
// Diese Funktion wird jetzt nicht mehr automatisch,
// sondern gezielt von main.js aufgerufen.
export function initializeDebugUI() {
    logOutputElement = document.getElementById('debug-log-output');
    const clearButton = document.getElementById('debug-clear-btn');
    
    if (logOutputElement && clearButton) {
        clearButton.addEventListener('click', () => {
            logOutputElement.innerHTML = '';
        });
        // Wir können hier nicht 'Debug.log' verwenden, da es eine Endlosschleife auslösen könnte
        console.log("On-Screen-Debugger UI initialisiert."); 
    } else if (DEBUG_MODE) {
        console.warn("Debug.js: On-Screen-Debug-UI-Elemente (output/clear) nicht im DOM gefunden.");
    }
}

// --- ENTFERNT ---
// Der 'DOMContentLoaded' Listener wurde entfernt, um die Race Condition zu beheben.

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
                    dataElement.textContent = JSON.stringify(param, null, 2);
                } catch (e) {
                    dataElement.textContent = "[Konnte Objekt nicht stringifizieren]";
                }
                logEntry.appendChild(dataElement);
            });
        }
        
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
        let errorDetails = (error instanceof Error) ? `${error.name}: ${error.message}` : error;
        writeLog('error', `${message} -> ${errorDetails}`, ...optionalParams);
    }
};
