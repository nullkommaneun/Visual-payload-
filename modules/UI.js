// modules/UI.js: Verantwortlich für das gesamte DOM-Rendering

import { Debug } from './Debug.js';
import { PayloadParser } from './PayloadParser.js'; // Wird für Deep Dive benötigt

export class UI {
    constructor(store) {
        this.store = store;
        Debug.log("UI: Initialisiert.");
    }

    /**
     * Initialisiert die UI und abonniert notwendige Store-Events.
     */
    initialize() {
        Debug.log("UI: Abonniert Store-Events (z.B. 'classifiedDevicesUpdated').");
        
        // (Logik zum Initial-Rendern der UI-Komponenten (z.B. Upload-Zone) folgt)
        
        // Hört auf Änderungen, um die Liste neu zu zeichnen
        this.store.subscribe('classifiedDevicesUpdated', (devices) => {
            this.renderDeviceList(devices);
        });
        
        // Hört auf Änderungen, um das Detail-Panel zu zeichnen
        this.store.subscribe('selectedDeviceUpdated', (device) => {
            this.renderDeepDive(device);
        });
    }

    renderDeviceList(devices) {
        // (Logik zum Erstellen der Liste in '#dashboard-section' folgt)
        Debug.log(`UI: Render Geräte-Liste mit ${devices.length} Geräten.`);
    }
    
    renderDeepDive(device) {
        // (Logik für Payload-Tabelle, Chart.js-Graph, Verhaltens-Analyse folgt)
        Debug.log(`UI: Render Deep Dive für Gerät ${device?.name || 'keins'}.`);
        
        // Beispiel: Hier würde der PayloadParser genutzt
        if (device) {
            const parsed = PayloadParser.parsePayload(device.rawDataPayload);
            // ... und dann 'parsed' im DOM anzeigen.
        }
    }
}
