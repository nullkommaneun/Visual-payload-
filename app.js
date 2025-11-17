// app.js: Unser gebündelter App-Code
// (Version 7: Regel-Priorität korrigiert, FTF-Payload-Decoder implementiert)

function runApp() {
    'use strict';

    // --- Modul: Debug.js ---
    const APP_NAME = "BLE_Dashboard";
    const DEBUG_MODE = true;
    let logOutputElement = null;

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

    function writeLog(level, message, ...optionalParams) {
        if (!DEBUG_MODE) return;
        const timestamp = new Date().toLocaleTimeString('de-DE');
        const fullMessage = `[${APP_NAME}] ${message}`;
        console[level](fullMessage, ...optionalParams);
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

    const Debug = {
        log: (message, ...optionalParams) => writeLog('log', message, ...optionalParams),
        warn: (message, ...optionalParams) => writeLog('warn', message, ...optionalParams),
        error: (message, error, ...optionalParams) => {
            let errorDetails = (error instanceof Error) ? `${error.name}: ${error.message}` : error;
            writeLog('error', `${message} -> ${errorDetails}`, ...optionalParams);
        }
    };

    // --- Modul: PayloadParser.js (ERWEITERT) ---
    const PayloadParser = {
        hexToAscii: (hex) => {
            let str = '';
            for (let i = 0; i < hex.length; i += 2) {
                const charCode = parseInt(hex.substr(i, 2), 16);
                if (charCode >= 32 && charCode <= 126) {
                    str += String.fromCharCode(charCode);
                } else {
                    str += '.';
                }
            }
            return str;
        },
        parseToTable: (hexPayload) => {
            if (!hexPayload) return [];
            const bytes = [];
            for (let i = 0; i < hexPayload.length; i += 2) {
                const hex = hexPayload.substr(i, 2).toUpperCase();
                const dec = parseInt(hex, 16);
                bytes.push({
                    offset: `0x${(i/2).toString(16).padStart(2, '0')}`,
                    hex: `0x${hex}`,
                    bin: dec.toString(2).padStart(8, '0'),
                    ascii: (dec >= 32 && dec <= 126) ? String.fromCharCode(dec) : '.'
                });
            }
            return bytes;
        },
        
        /**
         * Zerlegt den Payload in eine lesbare Segment-Tabelle
         */
        parsePayload: (hexPayload) => {
            if (!hexPayload) return [{ description: "Fehler", value: "Kein Payload vorhanden." }];
            
            const segments = [];
            const payloadLower = hexPayload.toLowerCase();
            
            // --- NEU: FTF-DECODER (basierend auf Ihrem Payload 10053F1CF56D9B) ---
            // Wir suchen nach der FTF-Signatur (hier: '...91005...')
            const ftfSignatureIndex = payloadLower.indexOf('91005'); 
            
            if (ftfSignatureIndex > -1) {
                // Teil 1: Die Daten vor der Signatur (vermutlich Apple-Daten)
                const appleData = hexPayload.substring(0, ftfSignatureIndex);
                segments.push({ 
                    description: "Präfix (Apple)", 
                    value: appleData.length > 20 ? appleData.substring(0, 20) + '...' : appleData 
                });

                // Teil 2: Die FTF-Signatur selbst extrahieren
                // Annahme: ...910053F1CF56D9B
                const ftfData = hexPayload.substring(ftfSignatureIndex); 
                
                segments.push({ description: "FTF-Kennung", value: ftfData.substring(0, 2) }); // "91"
                segments.push({ description: "Typ/Präfix", value: ftfData.substring(2, 6) }); // "0053"
                segments.push({ description: "Sensor-ID (Annahme)", value: ftfData.substring(6, 10) }); // "F1CF"
                segments.push({ description: "Status (Annahme)", value: ftfData.substring(10, 14) }); // "56D9"
                segments.push({ description: "Checksum (Annahme)", value: ftfData.substring(14) }); // "B"
            } 
            // Andere bekannte Muster
            else if (payloadLower.includes('06c5')) { 
               segments.push({ description: "Kennung", value: "06C5 (Cypress, FTF?)" });
               segments.push({ description: "Daten", value: hexPayload.substring(payloadLower.indexOf('06c5') + 4) });
            } 
            else if (payloadLower.startsWith('1005') || payloadLower.startsWith('1006') || payloadLower.startsWith('1007')) {
                segments.push({ description: "Apple (iBeacon)", value: "Proximity-Daten" });
                segments.push({ description: "Rohdaten", value: hexPayload });
            }
            else {
               segments.push({ description: "Unbekannt", value: hexPayload });
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
            const device = this.state.classifiedDevices.find(d => d.deviceId === deviceId) || null;
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
    
    // Regeln (Achten Sie auf 'includes' statt 'startsWith')
    const CONSUMER_COMPANIES = ['unbekannt (0x004c)']; // Apple
    const FTF_PAYLOAD_RULES = ['06c5', '91005']; // (Regel aus System-Prompt und Ihre Entdeckung)

    class MLClassifier {
        constructor(store) {
            this.store = store;
            Debug.log("MLClassifier: Initialisiert.");
        }
        initialize() {
            Debug.log("MLClassifier: Abonniert Store-Event 'rawDevicesUpdated'.");
            this.store.subscribe('rawDevicesUpdated', (devices) => {
                Debug.log(`MLClassifier: Event 'rawDevicesUpdated' EMPFANGEN. Starte Klassifizierung für ${devices.length} Geräte.`);
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
            
            Debug.log("MLClassifier: Klassifizierung abgeschlossen.", classifiedDevices.map(d => d.classification));
            this.store.setClassifiedDevices(classifiedDevices);
        }
        
        // --- KERNLOGIK AKTUALISIERT (REIHEfolge GEÄNDERT) ---
        applyRules(device) {
            const company = (device.company || '').toLowerCase();
            const payload = (device.rawDataPayload || '').toLowerCase();
            const name = (device.deviceName || '').toLowerCase();

            // Regel 1: Explizites FTF-Flag (Höchste Priorität)
            if (device.isFtf === true) {
                return "FTF";
            }
            
            // Regel 2: FTF-Payload-Prüfung (JETZT VORHER)
            // Wir prüfen, ob der Payload die Regel *enthält*
            if (payload && FTF_PAYLOAD_RULES.some(rule => payload.includes(rule))) {
                return "FTF";
            }
            
            // Regel 3: Consumer-Geräte (Hersteller-ID)
            if (company && CONSUMER_COMPANIES.some(consCompany => company.includes(consCompany))) {
                return "Consumer";
            }
            
            // Regel 4: Consumer-Geräte (Name)
            if (name.includes('jbl') || name.includes('srs-') || name.includes('flipper') || name.includes('bose') || name.includes('soundlink')) {
                return "Consumer";
            }
            
            // Regel 5: Fallback
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
            this.fileLoaderUI = document.getElementById('file-loader-ui');
            this.dropZone = this.fileLoaderUI.querySelector('#drop-zone');
            this.fileInput = this.fileLoaderUI.querySelector('#file-input');
            if (!this.dropZone || !this.fileInput) {
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
            this.rssiChart = null;
            Debug.log("UI: Initialisiert.");
        }
        
        initialize() {
            Debug.log("UI: Rendere initiale Komponenten...");
            this.renderFileLoader(); 
            this.renderDashboardLayout();
            Debug.log("UI: Abonniert Store-Events.");
            this.store.subscribe('loadingChanged', (isLoading) => this.showLoading(isLoading));
            this.store.subscribe('errorOccurred', (message) => this.showError(message));
            this.store.subscribe('classifiedDevicesUpdated', (devices) => {
                Debug.log(`UI: Event 'classifiedDevicesUpdated' EMPFANGEN. Rendere Liste mit ${devices.length} Geräten.`);
                this.renderDeviceList(devices, this.store.state.currentFilter);
            });
            this.store.subscribe('filterChanged', (filter) => { this.renderDeviceList(this.store.state.classifiedDevices, filter); });
            this.store.subscribe('selectedDeviceUpdated', (device) => {
                this.renderDeepDive(device);
                this.highlightSelectedItem(device ? device.deviceId : null);
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
            const displayName = device.deviceName || "(Unbekanntes Gerät)";
            const payloadPreview = (device.rawDataPayload || "").substring(0, 20); 
            
            let lastRssi = 'N/A';
            if (Array.isArray(device.rssiGraph) && device.rssiGraph.length > 0) {
                const lastEntry = device.rssiGraph[device.rssiGraph.length - 1];
                if (Array.isArray(lastEntry) && lastEntry.length > 1) {
                    lastRssi = lastEntry[1];
                }
            }

            return `
                <div class="device-item ${classificationClass}" data-device-id="${device.deviceId}">
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
        
        analyzeBehavior(device) {
            const analysis = {
                interval: 'N/A',
                packetLength: 'N/A'
            };
            
            if (device.rssiGraph && device.rssiGraph.length > 1) {
                const timestamps = device.rssiGraph.map(entry => entry[0]);
                const deltas = [];
                for (let i = 1; i < timestamps.length; i++) {
                    const delta = timestamps[i] - timestamps[i-1];
                    if (delta > 0) deltas.push(delta);
                }
                if (deltas.length > 0) {
                    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
                    analysis.interval = `~${(avgDelta * 1000).toFixed(0)} ms`;
                } else if (timestamps.length > 0) {
                    analysis.interval = "Einzelnes Paket";
                }
            }
            
            if (device.history && device.history.length > 0) {
                const lengths = device.history.map(h => h.p.length);
                const uniqueLengths = [...new Set(lengths)];
                if (uniqueLengths.length === 1) {
                    analysis.packetLength = `Konstant (${uniqueLengths[0] / 2} Bytes)`;
                } else {
                    analysis.packetLength = `Variabel (${Math.min(...lengths) / 2} - ${Math.max(...lengths) / 2} Bytes)`;
                }
            }
            return analysis;
        }

        renderDeepDive(device) {
            if (!device) {
                if (this.rssiChart) {
                    this.rssiChart.destroy();
                    this.rssiChart = null;
                }
                this.deepDiveSection.innerHTML = `<p>Kein Gerät für Detailansicht ausgewählt.</p>`;
                return;
            }

            Debug.log(`UI: Render Deep Dive für Gerät ${device.deviceName || 'keins'}.`);
            
            const behavior = this.analyzeBehavior(device);
            const payloadSegments = PayloadParser.parsePayload(device.rawDataPayload);
            const payloadTable = PayloadParser.parseToTable(device.rawDataPayload);

            const html = `
                <h3 class="${device.classification.toLowerCase()}">${device.deviceName || '(Unbekannt)'}</h3>
                
                <div class="deep-dive-section">
                    <h4>Verhaltens-Analyse ("WIE")</h4>
                    <table class="analysis-table">
                        <tr><th>Klassifizierung</th><td class="${device.classification.toLowerCase()}">${device.classification}</td></tr>
                        <tr><th>Hersteller</th><td>${device.company}</td></tr>
                        <tr><th>Sendeintervall</th><td class="description">${behavior.interval}</td></tr>
                        <tr><th>Paketlänge</th><td class="description">${behavior.packetLength}</td></tr>
                        <tr><th>Typ</th><td>${device.type}</td></tr>
                    </table>
                </div>

                <div class="deep-dive-section">
                    <h4>Signal-Analyse ("WIE")</h4>
                    <div id="rssi-chart-container">
                        <canvas id="rssi-chart-canvas"></canvas>
                    </div>
                </div>

                <div class="deep-dive-section">
                    <h4>Payload-Analyse ("WAS")</h4>
                    <table class="analysis-table">
                        ${payloadSegments.map(seg => `
                            <tr><th>${seg.description}</th><td>${seg.value}</td></tr>
                        `).join('')}
                    </table>
                </div>
                
                <div class="deep-dive-section">
                    <h4>Payload (Rohdaten-Tabelle)</h4>
                    <table class="analysis-table payload-table">
                        ${payloadTable.map(byte => `
                            <tr>
                                <td class="byte-offset">${byte.offset}</td>
                                <td class="hex">${byte.hex}</td>
                                <td class="ascii">${byte.ascii}</td>
                                <td class="binary">${byte.bin}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
            `;
            
            this.deepDiveSection.innerHTML = html;
            
            setTimeout(() => this.renderRssiChart(device.rssiGraph), 0);
        }
        
        renderRssiChart(rssiData) {
            const canvas = document.getElementById('rssi-chart-canvas');
            if (!canvas) {
                Debug.warn("UI: Chart.js Canvas nicht gefunden.");
                return;
            }
            const ctx = canvas.getContext('2d');

            if (this.rssiChart) {
                this.rssiChart.destroy();
            }
            
            if (!rssiData || rssiData.length === 0) {
                Debug.warn("UI: Keine rssiGraph-Daten zum Zeichnen.");
                return;
            }

            const labels = rssiData.map(entry => entry[0] + 's');
            const data = rssiData.map(entry => entry[1]);

            const style = getComputedStyle(document.body);
            const gridColor = style.getPropertyValue('--color-border');
            const textColor = style.getPropertyValue('--color-text-secondary');
            const lineColor = style.getPropertyValue('--color-ftf');

            this.rssiChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'RSSI Signalverlauf (in dBm)',
                        data: data,
                        borderColor: lineColor,
                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                        borderWidth: 2,
                        pointRadius: 2,
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: false,
                            min: -100,
                            max: -20,
                            grid: { color: gridColor },
                            ticks: { color: textColor }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { 
                                color: textColor,
                                maxTicksLimit: 10
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }
        
    } // Ende UI-Klasse

    // --- Modul: main.js (jetzt 'initApp') ---
    function initApp() {
        initializeDebugUI(); 
        Debug.log("App initialisiert. Starte Module...");
        
        const store = new Store();
        const fileLoader = new FileLoader(store);
        const classifier = new MLClassifier(store);
        const ui = new UI(store);
        
        ui.initialize();
        fileLoader.initialize(); 
        classifier.initialize(); 
        
        Debug.log("Alle Module sind betriebsbereit.");
    }
    
    // App starten
    initApp();

} // Ende von runApp()

document.addEventListener('DOMContentLoaded', runApp);
 
