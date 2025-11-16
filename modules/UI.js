// modules/UI.js: Verantwortlich für das gesamte DOM-Rendering

import { Debug } from './Debug.js';
import { PayloadParser } from './PayloadParser.js'; // Wird für Deep Dive benötigt

export class UI {
    constructor(store) {
        this.store = store;
        
        // DOM-Elemente für schnellen Zugriff cachen
        this.fileLoaderSection = document.getElementById('file-loader-ui');
        this.dashboardSection = document.getElementById('dashboard-ui');
        this.deepDiveSection = document.getElementById('deep-dive-content');
        
        Debug.log("UI: Initialisiert.");
    }

    /**
     * Initialisiert die UI und abonniert notwendige Store-Events.
     */
    initialize() {
        Debug.log("UI: Rendere initiale Komponenten...");
        this.renderFileLoader(); // Baut die HTML-Struktur für den FileLoader auf
        
        Debug.log("UI: Abonniert Store-Events.");
        
        // Hört auf Lade-Status (z.B. Datei-Upload)
        this.store.subscribe('loadingChanged', (isLoading) => {
            this.showLoading(isLoading);
        });
        
        // Hört auf Fehler
        this.store.subscribe('errorOccurred', (message) => {
            this.showError(message);
        });

        // Hört auf neue klassifizierte Daten
        this.store.subscribe('classifiedDevicesUpdated', (devices) => {
            this.renderDeviceList(devices);
        });
        
        // Hört auf das ausgewählte Gerät
        this.store.subscribe('selectedDeviceUpdated', (device) => {
            this.renderDeepDive(device);
        });
    }

    /**
     * Baut das HTML für die File-Loader-Komponente (Drop-Zone, Input-Fallback).
     */
    renderFileLoader() {
        const html = `
            <div id="drop-zone" class="drop-zone">
                <div class="drop-zone-text">
                    <p>JSON-Datei hierher ziehen</p>
                    <p>oder</p>
                    <label for="file-input" class="file-input-label">Datei auswählen</label>
                    <input type="file" id="file-input" accept=".json,application/json" style="display: none;">
                </div>
                <div class="loading-spinner" style="display: none;"></div>
                <div class="error-message" style="display: none;"></div>
            </div>
        `;
        this.fileLoaderSection.innerHTML = html;
    }
    
    /**
     * Zeigt/Versteckt den Lade-Indikator.
     * @param {boolean} isLoading
     */
    showLoading(isLoading) {
        const spinner = this.fileLoaderSection.querySelector('.loading-spinner');
        const text = this.fileLoaderSection.querySelector('.drop-zone-text');
        
        if (spinner && text) {
            spinner.style.display = isLoading ? 'block' : 'none';
            text.style.display = isLoading ? 'none' : 'block';
            if (isLoading) {
                // Auch Fehler verstecken, wenn neu geladen wird
                this.showError(null); 
            }
        }
    }
    
    /**
     * Zeigt eine Fehlermeldung in der File-Loader-Komponente an.
     * @param {string | null} message
     */
    showError(message) {
        const errorEl = this.fileLoaderSection.querySelector('.error-message');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = message ? 'block' : 'none';
        }
    }

    renderDeviceList(devices) {
        // (Logik zum Erstellen der Liste in '#dashboard-ui' folgt)
        Debug.log(`UI: Render Geräte-Liste mit ${devices.length} Geräten.`);
        
        // Platzhalter, damit wir sehen, dass es funktioniert
        if (devices.length > 0) {
            this.dashboardSection.innerHTML = `<p>${devices.length} Geräte klassifiziert. (Rendering folgt)</p>`;
        } else {
            this.dashboardSection.innerHTML = `<p>Warte auf klassifizierte Geräte...</p>`;
        }
    }
    
    renderDeepDive(device) {
        // (Logik für Payload-Tabelle, Chart.js-Graph, Verhaltens-Analyse folgt)
        Debug.log(`UI: Render Deep Dive für Gerät ${device?.name || 'keins'}.`);
        
        if (device) {
            const parsed = PayloadParser.parsePayload(device.rawDataPayload);
            this.deepDiveSection.innerHTML = `<pre>${JSON.stringify(parsed, null, 2)}</pre>`;
        } else {
            this.deepDiveSection.innerHTML = `<p>Kein Gerät für Detailansicht ausgewählt.</p>`;
        }
    }
}
