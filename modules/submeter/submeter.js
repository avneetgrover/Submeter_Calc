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
    initThemeManager();
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

    const themeSelect = document.getElementById('themeSelect');
    themeSelect.innerHTML = `
        <option value="system">${config.themeOptions.system}</option>
        <option value="light">${config.themeOptions.light}</option>
        <option value="dark">${config.themeOptions.dark}</option>
    `;
}

function initThemeManager() {
    const themeSelect = document.getElementById('themeSelect');
    const systemQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const savedTheme = localStorage.getItem(THEME_KEY) || 'system';
    themeSelect.value = savedTheme;
    applyTheme(savedTheme);

    themeSelect.addEventListener('change', (e) => {
        const theme = e.target.value;
        localStorage.setItem(THEME_KEY, theme);
        applyTheme(theme);
    });

    systemQuery.addEventListener('change', () => {
        if (localStorage.getItem(THEME_KEY) === 'system') applyTheme('system');
    });
}

function applyTheme(theme) {
    if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
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
        netBillInput.value = '';
        mainUnitsInput.value = '';
        oldReadingInput.value = '';
        newReadingInput.value = '';
        localStorage.removeItem(STORAGE_KEY);
        calculate();
    });

    calculate();

    function calculate() {
        const netBill = parseFloat(netBillInput.value) || 0;
        const mainUnits = parseFloat(mainUnitsInput.value) || 0;
        const oldReading = parseFloat(oldReadingInput.value) || 0;
        const newReading = parseFloat(newReadingInput.value) || 0;

        const rateContainer = document.getElementById('subRateResult');
        const unitsContainer = document.getElementById('subUnitsResult');
        const amountContainer = document.getElementById('subAmountResult');
        const errorContainer = document.getElementById('subErrorMsg');

        errorContainer.classList.add('hidden');
        errorContainer.textContent = '';

        const costPerUnit = mainUnits > 0 ? (netBill / mainUnits) : 0;
        const roundedRate = Math.round(costPerUnit * 100) / 100;

        let consumedUnits = 0;
        let isInvalid = false;

        if (newReading < oldReading) {
            isInvalid = true;
            errorContainer.textContent = config.errorMessages.invalidReading;
            errorContainer.classList.remove('hidden');
        } else {
            consumedUnits = newReading - oldReading;
        }

        const amountToPay = isInvalid ? 0 : (consumedUnits * roundedRate);

        rateContainer.textContent = `${config.currencySymbol} ${roundedRate.toFixed(2)} / kWh`;
        unitsContainer.textContent = isInvalid ? 'Invalid' : `${consumedUnits.toLocaleString()} kWh`;
        amountContainer.textContent = `${config.currencySymbol} ${amountToPay.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function saveData() {
        const data = {
            netBill: netBillInput.value,
            mainUnits: mainUnitsInput.value,
            oldReading: oldReadingInput.value,
            newReading: newReadingInput.value
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function loadSavedData() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        try {
            const data = JSON.parse(saved);
            if (data.netBill !== undefined) netBillInput.value = data.netBill;
            if (data.mainUnits !== undefined) mainUnitsInput.value = data.mainUnits;
            if (data.oldReading !== undefined) oldReadingInput.value = data.oldReading;
            if (data.newReading !== undefined) newReadingInput.value = data.newReading;
        } catch (e) {
            console.error('Failed to parse saved submeter data', e);
        }
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
                const canvas = await html2canvas(printableArea);
                canvas.toBlob(async (blob) => {
                    const file = new File([blob], 'submeter-bill-summary.png', { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: 'Submeter Electricity Summary',
                            text: 'Here is the submeter electricity calculation.'
                        });
                    } else {
                        fallbackTextShare();
                    }
                });
            } catch (err) {
                console.error('Share failed', err);
                fallbackTextShare();
            }
        } else {
            fallbackTextShare();
        }
    });

    function fallbackTextShare() {
        const text = `Submeter Bill Summary:\nTotal Payable: ${document.getElementById('subAmountResult').textContent}`;
        if (navigator.share) {
            navigator.share({ title: 'Submeter Bill', text: text });
        } else {
            navigator.clipboard.writeText(text);
            alert('Summary copied to clipboard!');
        }
    }
}
