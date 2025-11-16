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
        this.renderFileLoader(); 
        
        // Initiales Rendern der (leeren) Dashboard-Sektion
        this.renderDashboardLayout();
        
        Debug.log("UI: Abonniert Store-Events.");
        
        this.store.subscribe('loadingChanged', (isLoading) => this.showLoading(isLoading));
        this.store.subscribe('errorOccurred', (message) => this.showError(message));

        // Hört auf neue klassifizierte Daten
        this.store.subscribe('classifiedDevicesUpdated', (devices) => {
            this.renderDeviceList(devices, this.store.state.currentFilter);
        });
        
        // Hört auf Filter-Änderungen, um die Liste neu zu zeichnen
        this.store.subscribe('filterChanged', (filter) => {
            this.renderDeviceList(this.store.state.classifiedDevices, filter);
        });
        
        // Hört auf das ausgewählte Gerät
        this.store.subscribe('selectedDeviceUpdated', (device) => {
            this.renderDeepDive(device);
            // Hebt das ausgewählte Item in der Liste hervor
            this.highlightSelectedItem(device ? device.id : null);
        });
        
        // Event Listeners für die Dashboard-Sektion (Filter, Klicks)
        this.addDashboardEventListeners();
    }

    // --- File Loader Rendering (unverändert) ---
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
    showLoading(isLoading) { /* ... (unverändert) ... */ }
    showError(message) { /* ... (unverändert) ... */ }
    
    // --- NEU: Dashboard Rendering ---

    /**
     * Rendert das Grund-Layout für Filter und Liste.
     */
    renderDashboardLayout() {
        const filterState = this.store.state.currentFilter;
        const html = `
            <div class="dashboard-filter" id="dashboard-filter">
                <label>
                    <input type_="checkbox" data-filter="showFTF" ${filterState.showFTF ? 'checked' : ''}>
                    FTF (${this.getDeviceCount('FTF')})
                </label>
                <label>
                    <input type="checkbox" data-filter="showConsumer" ${filterState.showConsumer ? 'checked' : ''}>
                    Consumer (${this.getDeviceCount('Consumer')})
                </label>
                <label>
                    <input type="checkbox" data-filter="showIrrelevant" ${filterState.showIrrelevant ? 'checked' : ''}>
                    Irrelevant (${this.getDeviceCount('Irrelevant')})
                </label>
            </div>
            <div class="device-list" id="device-list-container">
                <p>Bitte Scan-Protokoll laden.</p>
            </div>
        `;
        this.dashboardSection.innerHTML = html;
    }

    /**
     * Zeichnet die Liste der Geräte basierend auf Filtern neu.
     * @param {Array} devices - Die klassifizierten Geräte
     * @param {object} filter - Das aktuelle Filter-Objekt
     */
    renderDeviceList(devices, filter) {
        Debug.log(`UI: Render Geräte-Liste mit ${devices.length} Geräten und Filter`, filter);
        
        const listContainer = document.getElementById('device-list-container');
        if (!listContainer) return;

        // 1. Geräte filtern
        const filteredDevices = devices.filter(device => {
            if (device.classification === 'FTF' && filter.showFTF) return true;
            if (device.classification === 'Consumer' && filter.showConsumer) return true;
            if (device.classification === 'Irrelevant' && filter.showIrrelevant) return true;
            return false;
        });

        // 2. Geräte sortieren (FTFs immer zuerst)
        const sortedDevices = filteredDevices.sort((a, b) => {
            if (a.classification === 'FTF' && b.classification !== 'FTF') return -1;
            if (a.classification !== 'FTF' && b.classification === 'FTF') return 1;
            // Sekundär-Sortierung (optional, z.B. nach RSSI)
            // return (b.rssi || -100) - (a.rssi || -100); 
            return 0;
        });

        // 3. HTML generieren
        if (sortedDevices.length === 0) {
            listContainer.innerHTML = `<p>Keine Geräte entsprechen den aktuellen Filtern.</p>`;
        } else {
            listContainer.innerHTML = sortedDevices.map(device => 
                this.createDeviceItemHTML(device)
            ).join('');
        }
        
        // 4. Filter-Zähler aktualisieren
        this.updateFilterCounts();
    }
    
    /**
     * Erstellt das HTML für ein einzelnes Gerät in der Liste.
     * @param {object} device
     */
    createDeviceItemHTML(device) {
        const classificationClass = device.classification.toLowerCase();
        const displayName = device.name || "(Unbekanntes Gerät)";
        const payloadPreview = (device.rawDataPayload || "").substring(0, 20); // Erste 20 Zeichen
        const lastRssi = Array.isArray(device.rssiGraph) && device.rssiGraph.length > 0 
                         ? device.rssiGraph[device.rssiGraph.length - 1] 
                         : (device.rssi || 'N/A');

        return `
            <div class_="device-item ${classificationClass}" data-device-id="${device.id}">
                <span class="device-classification-tag ${classificationClass}">${device.classification}</span>
                <div class="device-info">
                    <strong>${displayName}</strong>
                    <span class="device-company">${device.company || 'Kein Hersteller'}</span>
                </div>
                <div class="device-payload-preview">
                    <code>${payloadPreview}...</code>
                </div>
                <div class="device-rssi">
                    <span>${lastRssi} dBm</span>
                </div>
            </div>
        `;
    }
    
    /**
     * Fügt Event-Listener für Filter und Geräteliste hinzu (Event Delegation).
     */
    addDashboardEventListeners() {
        this.dashboardSection.addEventListener('click', (e) => {
            // Event 1: Klick auf einen Filter-Checkbox
            const filterCheckbox = e.target.closest('input[data-filter]');
            if (filterCheckbox) {
                const filterName = filterCheckbox.dataset.filter;
                const isChecked = filterCheckbox.checked;
                this.store.setFilter({ [filterName]: isChecked });
                return; // Wichtig: Verhindert, dass Klick an .device-item weitergeht
            }

            // Event 2: Klick auf ein Gerät in der Liste
            const deviceItem = e.target.closest('.device-item');
            if (deviceItem) {
                const deviceId = deviceItem.dataset.deviceId;
                this.store.setSelectedDevice(deviceId);
            }
        });
    }

    /**
     * Aktualisiert die Zähler in den Filter-Labels.
     */
    updateFilterCounts() {
        const filterUI = document.getElementById('dashboard-filter');
        if (!filterUI) return;
        
        filterUI.querySelector('[data-filter="showFTF"]').parentElement.textContent = 
            ` FTF (${this.getDeviceCount('FTF')})`;
        filterUI.querySelector('[data-filter="showConsumer"]').parentElement.textContent = 
            ` Consumer (${this.getDeviceCount('Consumer')})`;
        filterUI.querySelector('[data-filter="showIrrelevant"]').parentElement.textContent = 
            ` Irrelevant (${this.getDeviceCount('Irrelevant')})`;
            
        // Checkboxen re-attachen (textContent löscht sie)
        filterUI.querySelectorAll('label').forEach(label => {
            const input = label.querySelector('input');
            if(input) label.prepend(input);
        });
    }

    getDeviceCount(classification) {
        return this.store.state.classifiedDevices.filter(d => d.classification === classification).length;
    }
    
    /**
     * Hebt das ausgewählte Item in der Liste hervor.
     */
    highlightSelectedItem(deviceId) {
        const listContainer = document.getElementById('device-list-container');
        if (!listContainer) return;

        // Alle 'selected'-Klassen entfernen
        listContainer.querySelectorAll('.device-item.selected').forEach(el => {
            el.classList.remove('selected');
        });

        // Das neue Item hervorheben
        if (deviceId) {
            const selectedItem = listContainer.querySelector(`.device-item[data-device-id="${deviceId}"]`);
            if (selectedItem) {
                selectedItem.classList.add('selected');
            }
        }
    }

    // --- Deep Dive Rendering (Platzhalter) ---
    renderDeepDive(device) {
        if (device) {
            Debug.log(`UI: Render Deep Dive für Gerät ${device.name || 'keins'}.`);
            const parsed = PayloadParser.parsePayload(device.rawDataPayload);
            this.deepDiveSection.innerHTML = `
                <h3>${device.name || '(Unbekanntes Gerät)'}</h3>
                <p>Klassifizierung: ${device.classification}</p>
                <h4>Payload (Vorschau)</h4>
                <pre>${JSON.stringify(parsed, null, 2)}</pre>
                <hr>
                <h4>Nächster Schritt:</h4>
                <p>Implementierung der Chart.js-Signalanalyse und Payload-Decoder-Tabelle.</p>
            `;
        } else {
            this.deepDiveSection.innerHTML = `<p>Kein Gerät für Detailansicht ausgewählt.</p>`;
        }
    }
}
