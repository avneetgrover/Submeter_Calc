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
    document.getElementById('appTitle').textContent = config.title;
    document.getElementById('appSubtitle').textContent = config.subtitle;
    document.getElementById('lblFormTitle').textContent = config.labels.formSectionTitle;
    document.getElementById('lblSummaryTitle').textContent = config.labels.summarySectionTitle;
    document.getElementById('lblNetBill').textContent = config.labels.netBill;
    document.getElementById('lblMainUnits').textContent = config.labels.mainUnits;
    document.getElementById('lblOldReading').textContent = config.labels.oldReading;
    document.getElementById('lblNewReading').textContent = config.labels.newReading;
    document.getElementById('lblRatePerUnit').textContent = config.labels.ratePerUnit;
    document.getElementById('lblSubmeterUnits').textContent = config.labels.submeterUnits;
    document.getElementById('lblTotalPayable').textContent = config.labels.totalPayable;
    document.getElementById('clearDataBtn').textContent = config.labels.resetBtn;
    
    document.getElementById('subNetBill').placeholder = config.placeholders.netBill;
    document.getElementById('subMainUnits').placeholder = config.placeholders.mainUnits;
    document.getElementById('subOldReading').placeholder = config.placeholders.oldReading;
    document.getElementById('subNewReading').placeholder = config.placeholders.newReading;
}

function initThemeManager(config) {
    const themeSelect = document.getElementById('themeSelect');
    const systemQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // 1. Populate dropdown options from submeter.json cleanly
    if (themeSelect && config.themeOptions) {
        themeSelect.innerHTML = `
            <option value="system">💻 ${config.themeOptions.system}</option>
            <option value="light">☀️ ${config.themeOptions.light}</option>
            <option value="dark">🌙 ${config.themeOptions.dark}</option>
        `;
    }

    // 2. Load saved preference or default to 'system'
    const savedTheme = localStorage.getItem(THEME_KEY) || 'system';
    if (themeSelect) {
        themeSelect.value = savedTheme;
    }

    // Apply saved or system theme immediately
    applyTheme(savedTheme);

    // 3. Dropdown change event listener
    themeSelect?.addEventListener('change', (e) => {
        const theme = e.target.value;
        localStorage.setItem(THEME_KEY, theme);
        applyTheme(theme);
    });

    // 4. Live listener for system dark/light mode switches when 'system' is active
    systemQuery.addEventListener('change', () => {
        if ((localStorage.getItem(THEME_KEY) || 'system') === 'system') {
            applyTheme('system');
        }
    });
}

function applyTheme(theme) {
    const root = document.documentElement; // <html> tag
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

    const rateEl = document.getElementById('subRateResult');
    const unitsEl = document.getElementById('subUnitsResult');
    const amountEl = document.getElementById('subAmountResult');

    if (rateEl) rateEl.textContent = `₹ ${rate.toFixed(2)} / kWh`;
    if (unitsEl) unitsEl.textContent = `${consumedUnits.toFixed(2)} kWh`;
    if (amountEl) amountEl.textContent = `₹ ${totalPayable.toFixed(2)}`;
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
        if (data.netBill) document.getElementById('subNetBill').value = data.netBill;
        if (data.mainUnits) document.getElementById('subMainUnits').value = data.mainUnits;
        if (data.oldReading) document.getElementById('subOldReading').value = data.oldReading;
        if (data.newReading) document.getElementById('subNewReading').value = data.newReading;
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
                    const file = new File([blob], 'submeter-summary.png', { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: 'Submeter Electricity Summary',
                            text: 'Here is the submeter bill calculation summary.'
                        });
                    }
                }, 'image/png');
            } catch (err) {
                console.error('Sharing failed', err);
            }
        }
    });
}
