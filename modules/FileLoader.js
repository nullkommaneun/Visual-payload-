// modules/FileLoader.js: Kümmert sich um Datei-Upload und Parsing

import { Debug } from './Debug.js';

export class FileLoader {
    constructor(store) {
        this.store = store; // Referenz auf den zentralen Store
        Debug.log("FileLoader: Initialisiert.");
    }

    /**
     * Initialisiert die UI-Elemente (z.B. Drop-Zone-Listener)
     */
    initialize() {
        Debug.log("FileLoader: UI-Listener werden initialisiert.");
        // (Logik zum Einrichten der Drop-Zone und des <input type="file"> folgt hier)
        // Beim Erfolg: this.store.setRawDevices(parsedData);
    }

    // (Interne Methoden zum Parsen der JSON folgen)
}
