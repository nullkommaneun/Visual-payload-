// modules/Debug.js: Konsistentes Logging-Modul

const APP_NAME = "BLE_Dashboard";
const DEBUG_MODE = true; // Globaler Schalter für Logs

export const Debug = {
    log: (message, ...optionalParams) => {
        if (DEBUG_MODE) {
            console.log(`[${APP_NAME}] ${message}`, ...optionalParams);
        }
    },
    
    warn: (message, ...optionalParams) => {
        if (DEBUG_MODE) {
            console.warn(`[${APP_NAME}] ${message}`, ...optionalParams);
        }
    },
    
    error: (message, error, ...optionalParams) => {
        if (DEBUG_MODE) {
            // Error-Objekte immer mit ausgeben
            console.error(`[${APP_NAME}] ${message}`, error, ...optionalParams);
        }
    }
};
