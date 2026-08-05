const STORAGE_KEY = 'asg_submeter_data';
const THEME_KEY = 'asg_submeter_theme';

export async function initApp() {
    let config;
    try {
        const response = await fetch('./modules/submeter/submeter.json');
        config = await response.json();
    } catch (e) {
        console.error('Failed to load submeter.json', e);
        return;
    }

    renderUIFromJSON(config);
    initThemeManager(config);
    initCalculator(config);
    initActions();
}

function renderUIFromJSON(config) {
    document.title = config.title;
    
    if (document.getElementById('appTitle')) document.getElementById('appTitle').textContent = config.title;
    if (document.getElementById('appSubtitle')) document.getElementById('appSubtitle').textContent = config.subtitle;
    if (document.getElementById('lblFormTitle')) document.getElementById('lblFormTitle').textContent = config.labels.formSectionTitle;
    if (document.getElementById('lblSummaryTitle')) document.getElementById('lblSummaryTitle').textContent = config.labels.summarySectionTitle;
    if (document.getElementById('lblNetBill')) document.getElementById('lblNetBill').textContent = config.labels.netBill;
    if (document.getElementById('lblMainUnits')) document.getElementById('lblMainUnits').textContent = config.labels.mainUnits;
    if (document.getElementById('lblOldReading')) document.getElementById('lblOldReading').textContent = config.labels.oldReading;
    if (document.getElementById('lblNewReading')) document.getElementById('lblNewReading').textContent = config.labels.newReading;
    if (document.getElementById('lblRatePerUnit')) document.getElementById('lblRatePerUnit').textContent = config.labels.ratePerUnit;
    if (document.getElementById('lblSubmeterUnits')) document.getElementById('lblSubmeterUnits').textContent = config.labels.submeterUnits;
    if (document.getElementById('lblTotalPayable')) document.getElementById('lblTotalPayable').textContent = config.labels.totalPayable;
    if (document.getElementById('clearDataBtn')) document.getElementById('clearDataBtn').textContent = config.labels.resetBtn;
    
    if (document.getElementById('subNetBill')) document.getElementById('subNetBill').placeholder = config.placeholders.netBill;
    if (document.getElementById('subMainUnits')) document.getElementById('subMainUnits').placeholder = config.placeholders.mainUnits;
    if (document.getElementById('subOldReading')) document.getElementById('subOldReading').placeholder = config.placeholders.oldReading;
    if (document.getElementById('subNewReading')) document.getElementById('subNewReading').placeholder = config.placeholders.newReading;
}

function initThemeManager(config) {
    const themeSelect = document.getElementById('themeSelect');
    const systemQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // 1. Clean theme options populate without repeating emojis
    if (themeSelect && config.themeOptions) {
        themeSelect.innerHTML = `
            <option value="system">${config.themeOptions.system}</option>
            <option value="light">${config.themeOptions.light}</option>
            <option value="dark">${config.themeOptions.dark}</option>
        `;
    }

    // 2. Load saved preference or default to 'system'
    const savedTheme = localStorage.getItem(THEME_KEY) || 'system';
    if (themeSelect) {
        themeSelect.value = savedTheme;
    }

    // Apply saved or system theme
    applyTheme(savedTheme);

    // 3. Dropdown change listener
    themeSelect?.addEventListener('change', (e) => {
        const theme = e.target.value;
        localStorage.setItem(THEME_KEY, theme);
        applyTheme(theme);
    });

    // 4. System appearance toggle listener
    systemQuery.addEventListener('change', () => {
        if ((localStorage.getItem(THEME_KEY) || 'system') === 'system') {
            applyTheme('system');
        }
    });
}

function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
        root.setAttribute('data-theme', theme);
    }
}

function initCalculator(config) {
    const netBillInput = document.getElementById('subNetBill');
    const mainUnitsInput = document.getElementById('subMainUnits');
    const oldReadingInput = document.getElementById('subOldReading');
    const newReadingInput = document.getElementById('subNewReading');
    const clearBtn = document.getElementById('clearDataBtn');

    loadSavedData();

    [netBillInput, mainUnitsInput, oldReadingInput, newReadingInput].forEach(inp => {
        inp?.addEventListener('input', () => {
            calculate();
            saveData();
        });
    });

    clearBtn?.addEventListener('click', () => {
        [netBillInput, mainUnitsInput, oldReadingInput, newReadingInput].forEach(inp => {
            if (inp) inp.value = '';
        });
        localStorage.removeItem(STORAGE_KEY);
        calculate();
    });

    calculate();
}

function calculate() {
    const netBill = parseFloat(document.getElementById('subNetBill')?.value) || 0;
    const mainUnits = parseFloat(document.getElementById('subMainUnits')?.value) || 0;
    const oldReading = parseFloat(document.getElementById('subOldReading')?.value) || 0;
    const newReading = parseFloat(document.getElementById('subNewReading')?.value) || 0;

    const errorBanner = document.getElementById('subErrorMsg');
    let isValid = true;
    let errorText = '';

    if (newReading < oldReading && newReading > 0) {
        isValid = false;
        errorText = 'New reading cannot be lower than the old reading.';
    }

    if (!isValid) {
        if (errorBanner) {
            errorBanner.textContent = errorText;
            errorBanner.classList.remove('hidden');
        }
    } else {
        if (errorBanner) {
            errorBanner.classList.add('hidden');
        }
    }

    const rate = mainUnits > 0 ? netBill / mainUnits : 0;
    const consumedUnits = newReading >= oldReading ? newReading - oldReading : 0;
    const totalPayable = consumedUnits * rate;

    // Sync values to the Right Column Receipt Panel
    const rateEl = document.getElementById('subRateResult');
    const unitsEl = document.getElementById('subUnitsResult');
    const amountEl = document.getElementById('subAmountResult');

    const receiptNetBill = document.getElementById('receiptNetBill');
    const receiptMainUnits = document.getElementById('receiptMainUnits');
    const receiptOldReading = document.getElementById('receiptOldReading');
    const receiptNewReading = document.getElementById('receiptNewReading');

    if (rateEl) rateEl.textContent = `₹ ${rate.toFixed(2)} / kWh`;
    if (unitsEl) unitsEl.textContent = `${consumedUnits.toFixed(2)} kWh`;
    if (amountEl) amountEl.textContent = `₹ ${totalPayable.toFixed(2)}`;

    // Populate receipt breakdown line items
    if (receiptNetBill) receiptNetBill.textContent = `₹ ${netBill.toFixed(2)}`;
    if (receiptMainUnits) receiptMainUnits.textContent = `${mainUnits} kWh`;
    if (receiptOldReading) receiptOldReading.textContent = oldReading;
    if (receiptNewReading) receiptNewReading.textContent = newReading;
}

function saveData() {
    const data = {
        netBill: document.getElementById('subNetBill')?.value || '',
        mainUnits: document.getElementById('subMainUnits')?.value || '',
        oldReading: document.getElementById('subOldReading')?.value || '',
        newReading: document.getElementById('subNewReading')?.value || ''
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadSavedData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
        const data = JSON.parse(saved);
        if (data.netBill && document.getElementById('subNetBill')) document.getElementById('subNetBill').value = data.netBill;
        if (data.mainUnits && document.getElementById('subMainUnits')) document.getElementById('subMainUnits').value = data.mainUnits;
        if (data.oldReading && document.getElementById('subOldReading')) document.getElementById('subOldReading').value = data.oldReading;
        if (data.newReading && document.getElementById('subNewReading')) document.getElementById('subNewReading').value = data.newReading;
    } catch (e) {
        console.error('Failed to parse stored calculator data', e);
    }
}

function initActions() {
    const printBtn = document.getElementById('btnPrint');
    const shareBtn = document.getElementById('btnShare');

    printBtn?.addEventListener('click', () => {
        window.print();
    });

    shareBtn?.addEventListener('click', async () => {
        const printableArea = document.getElementById('printableArea');
        if (navigator.share && window.html2canvas) {
            try {
                const canvas = await html2canvas(printableArea, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: getComputedStyle(document.body).backgroundColor
                });
                canvas.toBlob(async (blob) => {
                    if (!blob) return;
                    const file = new File([blob], 'electricity-challan-receipt.png', { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: 'Electricity Submeter Challan Receipt',
                            text: 'Here is the detailed submeter electricity settlement receipt.'
                        });
                    }
                }, 'image/png');
            } catch (err) {
                console.error('Sharing failed', err);
            }
        }
    });
}
