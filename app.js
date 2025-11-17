// app.js: Unser gebündelter App-Code, um das "file:///"-Problem zu umgehen.

// Wir verpacken die gesamte App in eine Funktion, um den globalen Scope zu schützen.
function runApp() {
    'use strict';

    // --- Modul: Debug.js ---
    const APP_NAME = "BLE_Dashboard";
    const DEBUG_MODE = true;
    let logOutputElement = null;

    /**
     * Initialisiert die On-Screen-Debug-UI.
     * Muss als Erstes aufgerufen werden.
     */
    function initializeDebugUI() {
        logOutputElement = document.getElementById('debug-log-output');
        const clearButton = document.getElementById('debug-clear-btn');
        if (logOutputElement && clearButton) {
            clearButton.addEventListener('click', () => { logOutputElement.innerHTML = ''; });
            console.log("On-Screen-Debugger UI initialisiert."); 
        } else if (DEBUG_MODE) {
            console.warn("Debug.js: On-Screen-Debug-UI-Elemente (output/clear) nicht im DOM gefunden.");
        }
    }

    /**
     * Schreibt einen Log-Eintrag (intern).
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
            const msgElement = document.createElement('span');
            msgElement.textContent = `[${timestamp}] ${message} `;
            logEntry.appendChild(msgElement);

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

    /**
     * Das globale Debug-Objekt.
     */
    const Debug = {
        log: (message, ...optionalParams) => writeLog('log', message, ...optionalParams),
        warn: (message, ...optionalParams) => writeLog('warn', message, ...optionalParams),
        error: (message, error, ...optionalParams) => {
            let errorDetails = (error instanceof Error) ? `${error.name}: ${error.message}` : error;
            writeLog('error', `${message} -> ${errorDetails}`, ...optionalParams);
        }
    };

    // --- Modul: PayloadParser.js ---
    const PayloadParser = {
        parsePayload: (hexPayload) => {
            if (!hexPayload) return { error: "Kein Payload vorhanden." };
            Debug.log(`PayloadParser: Parse Payload (${hexPayload.substring(0, 10)}...)`);
            const segments = {};
            // (Platzhalter-Logik von der Grundstruktur)
            if (hexPayload.toLowerCase().startsWith('06c5')) { 
               segments.prefix = { raw: "06C5", description: "Cypress-Kennung" };
               segments.data = { raw: hexPayload.substring(4), description: "Unbekannte Daten" };
            } else {
               segments.unknown = { raw: hexPayload, description: "Unbekannter Payload-Typ" };
            }
            return segments;
        },
    };

    // --- Modul: Store.js ---
    class Store {
        constructor() {
            this.state = {
                rawDevices: [],
                classifiedDevices: [],
                currentFilter: { showFTF: true, showConsumer: true, showIrrelevant: false },
                selectedDevice: null,
                isLoading: false,
                errorMessage: null
            };
            this.subscribers = {}; 
            Debug.log("Store: Initialisiert.");
        }
        subscribe(event, callback) {
            if (!this.subscribers[event]) { this.subscribers[event] = []; }
            this.subscribers[event].push(callback);
            Debug.log(`Store: Neue Subscription für Event [${event}]`);
        }
        notify(event, data) {
            if (!this.subscribers[event]) { return; }
            Debug.log(`Store: Notify Event [${event}]`);
            this.subscribers[event].forEach(callback => {
                try { callback(data); } catch (error) { Debug.error(`Fehler im Subscriber für Event [${event}]:`, error); }
            });
        }
        setRawDevices(devices) {
            this.state.rawDevices = devices;
            this.state.classifiedDevices = []; 
            this.state.selectedDevice = null;   
            Debug.log(`Store: ${devices.length} Roh-Geräte gesetzt.`);
            this.notify('rawDevicesUpdated', this.state.rawDevices);
        }
        setClassifiedDevices(devices) {
            this.state.classifiedDevices = devices;
            Debug.log(`Store: ${devices.length} klassifizierte Geräte gesetzt.`);
            this.notify('classifiedDevicesUpdated', this.state.classifiedDevices);
        }
        setFilter(filterUpdate) {
            this.state.currentFilter = { ...this.state.currentFilter, ...filterUpdate };
            Debug.log(`Store: Filter aktualisiert`, this.state.currentFilter);
            this.notify('filterChanged', this.state.currentFilter);
        }
        setSelectedDevice(deviceId) {
            const device = this.state.classifiedDevices.find(d => d.id === deviceId) || null;
            this.state.selectedDevice = device;
            Debug.log(`Store: Gerät ausgewählt`, device);
            this.notify('selectedDeviceUpdated', this.state.selectedDevice);
        }
        setIsLoading(isLoading) {
            this.state.isLoading = isLoading;
            this.notify('loadingChanged', this.state.isLoading);
        }
        setErrorMessage(message) {
            this.state.errorMessage = message;
            this.notify('errorOccurred', this.state.errorMessage);
        }
    }

    // --- Modul: MLClassifier.js ---
    const FTF_COMPANIES = ['linde material handling', 'kion group', 'jungheinrich ag', 'toyota material handling', 'dematic', 'omron corporation'];
    const CONSUMER_COMPANIES = ['apple, inc.', 'samsung electronics co., ltd.', 'google', 'microsoft', 'bose corporation', 'sony corporation', 'tile, inc.'];
    const FTF_PAYLOAD_PREFIXES = ['06c5', '09a1'];

    class MLClassifier {
        constructor(store) {
            this.store = store;
            Debug.log("MLClassifier: Initialisiert.");
        }
        initialize() {
            Debug.log("MLClassifier: Abonniert Store-Event 'rawDevicesUpdated'.");
            this.store.subscribe('rawDevicesUpdated', (devices) => {
                Debug.log(`MLClassifier: Event 'rawDevicesUpdated' EMPFANGEN. Starte Klassifizierung für ${devices.length} Geräte.`, devices);
                this.classifyDevices(devices);
            });
        }
        classifyDevices(devices) {
            if (!devices || devices.length === 0) {
                Debug.log("MLClassifier: Keine Geräte zum Klassifizieren vorhanden.");
                this.store.setClassifiedDevices([]);
                return;
            }
            Debug.log(`MLClassifier: Klassifiziere ${devices.length} Geräte...`);
            const classifiedDevices = devices.map(device => {
                const classification = this.applyRules(device);
                return { ...device, classification: classification };
            });
            this.store.setClassifiedDevices(classifiedDevices);
        }
        applyRules(device) {
            const company = (device.company || '').toLowerCase();
            const payload = (device.rawDataPayload || '').toLowerCase();
            if (company && FTF_COMPANIES.some(ftfCompany => company.includes(ftfCompany))) { return "FTF"; }
            if (payload && FTF_PAYLOAD_PREFIXES.some(prefix => payload.startsWith(prefix))) { return "FTF"; }
            if (company && CONSUMER_COMPANIES.some(consCompany => company.includes(consCompany))) { return "Consumer"; }
            return "Irrelevant";
        }
    }

    // --- Modul: FileLoader.js ---
    class FileLoader {
        constructor(store) {
            this.store = store; 
            this.fileLoaderUI = null;
            this.dropZone = null;
            this.fileInput = null;
            Debug.log("FileLoader: Initialisiert.");
        }
        initialize() {
            // (Diese Funktion wird jetzt NACH UI.initialize() aufgerufen)
            this.fileLoaderUI = document.getElementById('file-loader-ui');
            this.dropZone = this.fileLoaderUI.querySelector('#drop-zone');
            this.fileInput = this.fileLoaderUI.querySelector('#file-input');
            
            if (!this.dropZone || !this.fileInput) {
                // Dieser Fehler sollte jetzt nicht mehr auftreten
                Debug.error("FileLoader: Kritische UI-Elemente (drop-zone, file-input) nicht gefunden.");
                return;
            }
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => { this.dropZone.addEventListener(eventName, this.preventDefaults.bind(this), false); });
            ['dragenter', 'dragover'].forEach(eventName => { this.dropZone.addEventListener(eventName, this.highlightDropZone.bind(this), false); });
            ['dragleave', 'drop'].forEach(eventName => { this.dropZone.addEventListener(eventName, this.unhighlightDropZone.bind(this), false); });
            this.dropZone.addEventListener('drop', this.handleDrop.bind(this), false);
            this.fileInput.addEventListener('change', this.handleFileSelect.bind(this), false);
            Debug.log("FileLoader: UI-Listener sind initialisiert.");
        }
        preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
        highlightDropZone() { this.dropZone.classList.add('active'); }
        unhighlightDropZone() { this.dropZone.classList.remove('active'); }
        handleFileSelect(e) { const files = e.target.files; if (files.length > 0) { this.processFile(files[0]); } }
        handleDrop(e) { const dt = e.dataTransfer; const files = dt.files; if (files.length > 0) { this.processFile(files[0]); } }
        
        async processFile(file) {
            Debug.log(`FileLoader: Verarbeite Datei "${file.name}"...`);
            this.store.setIsLoading(true);
            this.store.setErrorMessage(null);
            if (file.type !== 'application/json') {
                this.store.setErrorMessage("Fehler: Es werden nur .json-Dateien akzeptiert.");
                this.store.setIsLoading(false);
                return;
            }
            try {
                const fileContent = await file.text();
                const jsonData = JSON.parse(fileContent);
                Debug.log("FileLoader: JSON-Daten geparst:", jsonData);
                
                if (!this.isValidScanData(jsonData)) {
                    Debug.warn("FileLoader: Validierung (isValidScanData) fehlgeschlagen!");
                    throw new Error("Die JSON-Datei hat nicht die erwartete Scan-Protokoll-Struktur (erwartet: { devices: [...] }).");
                }
                
                // Wir verwenden die Annahme 'jsonData.devices'. Der Debugger wird uns sagen, ob das falsch ist.
                this.store.setRawDevices(jsonData.devices || []);
                
            } catch (error) {
                Debug.error("FileLoader: Fehler beim Lesen/Parsen der Datei.", error);
                this.store.setErrorMessage(`Parsing-Fehler: ${error.message}`);
            } finally {
                this.store.setIsLoading(false);
                this.fileInput.value = ""; 
            }
        }
        
        isValidScanData(data) {
            // Wir bleiben bei der Annahme, dass es { devices: [...] } ist.
            return data && Array.isArray(data.devices);
        }
    }

    // --- Modul: UI.js ---
    class UI {
        constructor(store) {
            this.store = store;
            this.fileLoaderSection = document.getElementById('file-loader-ui');
            this.dashboardSection = document.getElementById('dashboard-ui');
            this.deepDiveSection = document.getElementById('deep-dive-content');
            Debug.log("UI: Initialisiert.");
        }
        
        initialize() {
            Debug.log("UI: Rendere initiale Komponenten...");
            this.renderFileLoader(); // Erstellt das HTML für den FileLoader
            this.renderDashboardLayout(); // Erstellt das HTML für Filter/Liste
            
            Debug.log("UI: Abonniert Store-Events.");
            this.store.subscribe('loadingChanged', (isLoading) => this.showLoading(isLoading));
            this.store.subscribe('errorOccurred', (message) => this.showError(message));
            this.store.subscribe('classifiedDevicesUpdated', (devices) => {
                Debug.log(`UI: Event 'classifiedDevicesUpdated' EMPFANGEN. Rendere Liste mit ${devices.length} Geräten.`, devices);
                this.renderDeviceList(devices, this.store.state.currentFilter);
            });
            this.store.subscribe('filterChanged', (filter) => { this.renderDeviceList(this.store.state.classifiedDevices, filter); });
            this.store.subscribe('selectedDeviceUpdated', (device) => {
                this.renderDeepDive(device);
                this.highlightSelectedItem(device ? device.id : null);
            });
            this.addDashboardEventListeners();
        }
        
        renderFileLoader() {
            const html = `<div id="drop-zone" class="drop-zone"><div class="drop-zone-text"><p>JSON-Datei hierher ziehen</p><p>oder</p><label for="file-input" class="file-input-label">Datei auswählen</label><input type="file" id="file-input" accept=".json,application/json" style="display: none;"></div><div class="loading-spinner" style="display: none;"></div><div class="error-message" style="display: none;"></div></div>`;
            this.fileLoaderSection.innerHTML = html;
        }
        
        showLoading(isLoading) {
            const spinner = this.fileLoaderSection.querySelector('.loading-spinner');
            const text = this.fileLoaderSection.querySelector('.drop-zone-text');
            if (spinner && text) {
                spinner.style.display = isLoading ? 'block' : 'none';
                text.style.display = isLoading ? 'none' : 'block';
                if (isLoading) { this.showError(null); }
            }
        }
        
        showError(message) {
            const errorEl = this.fileLoaderSection.querySelector('.error-message');
            if (errorEl) {
                errorEl.textContent = message;
                errorEl.style.display = message ? 'block' : 'none';
            }
        }
        
        renderDashboardLayout() {
            const filterState = this.store.state.currentFilter;
            const html = `<div class="dashboard-filter" id="dashboard-filter"><label><input type="checkbox" data-filter="showFTF" ${filterState.showFTF ? 'checked' : ''}> FTF (${this.getDeviceCount('FTF')})</label><label><input type="checkbox" data-filter="showConsumer" ${filterState.showConsumer ? 'checked' : ''}> Consumer (${this.getDeviceCount('Consumer')})</label><label><input type="checkbox" data-filter="showIrrelevant" ${filterState.showIrrelevant ? 'checked' : ''}> Irrelevant (${this.getDeviceCount('Irrelevant')})</label></div><div class="device-list" id="device-list-container"><p>Bitte Scan-Protokoll laden.</p></div>`;
            this.dashboardSection.innerHTML = html;
        }
        
        renderDeviceList(devices, filter) {
            Debug.log(`UI: (In renderDeviceList) Render Geräte-Liste mit ${devices.length} Geräten und Filter`, filter);
            const listContainer = document.getElementById('device-list-container');
            if (!listContainer) return;
            const filteredDevices = devices.filter(device => {
                if (device.classification === 'FTF' && filter.showFTF) return true;
                if (device.classification === 'Consumer' && filter.showConsumer) return true;
                if (device.classification === 'Irrelevant' && filter.showIrrelevant) return true;
                return false;
            });
            const sortedDevices = filteredDevices.sort((a, b) => {
                if (a.classification === 'FTF' && b.classification !== 'FTF') return -1;
                if (a.classification !== 'FTF' && b.classification === 'FTF') return 1;
                return 0;
            });
            if (sortedDevices.length === 0) {
                listContainer.innerHTML = `<p>Keine Geräte entsprechen den aktuellen Filtern.</p>`;
            } else {
                listContainer.innerHTML = sortedDevices.map(device => this.createDeviceItemHTML(device)).join('');
            }
            this.updateFilterCounts();
        }
        
        createDeviceItemHTML(device) {
            const classificationClass = device.classification.toLowerCase();
            const displayName = device.name || "(Unbekanntes Gerät)";
            const payloadPreview = (device.rawDataPayload || "").substring(0, 20); 
            const lastRssi = Array.isArray(device.rssiGraph) && device.rssiGraph.length > 0 ? device.rssiGraph[device.rssiGraph.length - 1] : (device.rssi || 'N/A');
            return `<div class="device-item ${classificationClass}" data-device-id="${device.id}"><span class="device-classification-tag ${classificationClass}">${device.classification}</span><div class="device-info"><strong>${displayName}</strong><span class="device-company">${device.company || 'Kein Hersteller'}</span></div><div class="device-payload-preview"><code>${payloadPreview}...</code></div><div class="device-rssi"><span>${lastRssi} dBm</span></div></div>`;
        }
        
        addDashboardEventListeners() {
            this.dashboardSection.addEventListener('click', (e) => {
                const filterCheckbox = e.target.closest('input[data-filter]');
                if (filterCheckbox) {
                    const filterName = filterCheckbox.dataset.filter;
                    const isChecked = filterCheckbox.checked;
                    this.store.setFilter({ [filterName]: isChecked });
                    return; 
                }
                const deviceItem = e.target.closest('.device-item');
                if (deviceItem) {
                    const deviceId = deviceItem.dataset.deviceId;
                    this.store.setSelectedDevice(deviceId);
                }
            });
        }
        
        updateFilterCounts() {
            const filterUI = document.getElementById('dashboard-filter');
            if (!filterUI) return;
            filterUI.querySelector('[data-filter="showFTF"]').parentElement.childNodes[1].nodeValue = ` FTF (${this.getDeviceCount('FTF')})`;
            filterUI.querySelector('[data-filter="showConsumer"]').parentElement.childNodes[1].nodeValue = ` Consumer (${this.getDeviceCount('Consumer')})`;
            filterUI.querySelector('[data-filter="showIrrelevant"]').parentElement.childNodes[1].nodeValue = ` Irrelevant (${this.getDeviceCount('Irrelevant')})`;
        }
        
        getDeviceCount(classification) { return this.store.state.classifiedDevices.filter(d => d.classification === classification).length; }
        
        highlightSelectedItem(deviceId) {
            const listContainer = document.getElementById('device-list-container');
            if (!listContainer) return;
            listContainer.querySelectorAll('.device-item.selected').forEach(el => el.classList.remove('selected'));
            if (deviceId) {
                const selectedItem = listContainer.querySelector(`.device-item[data-device-id="${deviceId}"]`);
                if (selectedItem) { selectedItem.classList.add('selected'); }
            }
        }
        
        renderDeepDive(device) {
            if (device) {
                Debug.log(`UI: Render Deep Dive für Gerät ${device.name || 'keins'}.`);
                const parsed = PayloadParser.parsePayload(device.rawDataPayload);
                this.deepDiveSection.innerHTML = `<h3>${device.name || '(Unbekanntes Gerät)'}</h3><p>Klassifizierung: ${device.classification}</p><h4>Payload (Vorschau)</h4><pre>${JSON.stringify(parsed, null, 2)}</pre><hr><h4>Nächster Schritt:</h4><p>Implementierung der Chart.js-Signalanalyse.</p>`;
            } else {
                this.deepDiveSection.innerHTML = `<p>Kein Gerät für Detailansicht ausgewählt.</p>`;
            }
        }
    } // Ende UI-Klasse

    // --- Modul: main.js (jetzt 'initApp') ---
    function initApp() {
        // 1. Debug-UI initialisieren (als erste Aktion hier)
        initializeDebugUI(); 
        Debug.log("App initialisiert. Starte Module...");
        
        // 2. Store initialisieren
        const store = new Store();

        // 3. Module initialisieren und Store injizieren
        const fileLoader = new FileLoader(store);
        const classifier = new MLClassifier(store);
        const ui = new UI(store);
        
        // 4. Initial-Setup
        //
        // --- KORRIGIERTE REIHENFOLGE ---
        //
        // ZUERST die UI initialisieren (damit HTML-Elemente erstellt werden)
        ui.initialize();
        // DANN den FileLoader (damit er die Elemente finden und Listener binden kann)
        fileLoader.initialize(); 
        // ZULETZT den Klassifizierer (Reihenfolge hier egal, da er nur auf den Store hört)
        classifier.initialize(); 
        
        Debug.log("Alle Module sind betriebsbereit.");
    }
    
    // App starten
    initApp();

} // Ende von runApp()

// Der globale Starter, der auf DOMContentLoaded wartet
document.addEventListener('DOMContentLoaded', runApp);
 
