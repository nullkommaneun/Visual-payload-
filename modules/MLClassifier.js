// modules/MLClassifier.js: Klassifiziert Geräte (FTF, Consumer, Irrelevant)

import { Debug } from './Debug.js';

export class MLClassifier {
    constructor(store) {
        this.store = store;
        Debug.log("MLClassifier: Initialisiert.");
    }

    /**
     * Registriert die notwendigen Listener beim Store.
     */
    initialize() {
        Debug.log("MLClassifier: Abonniert Store-Event 'rawDevicesUpdated'.");
        
        // Abonniert den Store. Wenn neue Rohdaten da sind, starte Klassifizierung
        this.store.subscribe('rawDevicesUpdated', (devices) => {
            this.classifyDevices(devices);
        });
    }
    
    /**
     * Führt die regelbasierte Klassifizierung durch.
     * @param {Array} devices - Die Roh-Geräte aus dem Store
     */
    classifyDevices(devices) {
        Debug.log(`MLClassifier: Klassifiziere ${devices.length} Geräte...`);
        
        // (Regelbasierte Klassifizierungs-Logik folgt hier)
        
        // (Nach der Klassifizierung, Ergebnis in den Store schreiben)
        // z.B. const classifiedData = ...
        // this.store.setClassifiedDevices(classifiedData);
    }
}
