import { log } from './modules/Debug.js';
import * as Store from './modules/Store.js';
import * as FileLoader from './modules/FileLoader.js';
import * as MLClassifier from './modules/MLClassifier.js';
import * as UI from './modules/UI.js';

const CONTEXT = 'Main';

/**
 * Initialisiert die Anwendung, sobald das DOM geladen ist.
 */
document.addEventListener('DOMContentLoaded', () => {
    log(CONTEXT, 'DOM content loaded. Initializing application...');

    try {
        // Module in der korrekten Reihenfolge initialisieren
        // 1. UI (findet seine HTML-Elemente)
        UI.init('overview-list', 'detail-content', 'loader', 'overview-filters');
        
        // 2. FileLoader (bindet Events an seine HTML-Elemente)
        FileLoader.init('file-loader-zone', 'file-input');
        
        // 3. MLClassifier (registriert seinen Listener beim Store)
        MLClassifier.init();

        // 4. Store (braucht kein init(), ist aber hier zur Vollständigkeit)
        log(CONTEXT, 'Store is implicitly ready.');
        
        log(CONTEXT, 'Application initialized successfully.');

    } catch (e) {
        console.error('[Main] Critical error during initialization:', e);
        // Hier könnte man eine Fehlermeldung im UI anzeigen
    }
});

