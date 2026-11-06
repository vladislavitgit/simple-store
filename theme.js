(() => {
    const storageKey = 'simple-store-theme';
    const root = document.documentElement;
    function applyTheme(value) {
        const dark = value === 'dark';
        root.dataset.theme = dark ? 'dark' : 'light';
        document.querySelector('meta[name="theme-color"]').content = dark ? '#151219' : '#ffffff';
        const button = document.getElementById('theme-toggle');
        if (!button) return;
        const label = dark ? 'Включить светлую тему' : 'Включить тёмную тему';
        button.setAttribute('aria-pressed', String(dark));
        button.setAttribute('aria-label', label);
        button.title = label;
    }
    let savedTheme;
    try {
        savedTheme = localStorage.getItem(storageKey);
    } catch {}
    applyTheme(savedTheme);
    document.addEventListener('DOMContentLoaded', () => {
        applyTheme(root.dataset.theme);
        document.getElementById('theme-toggle').addEventListener('click', () => {
            applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
            try {
                localStorage.setItem(storageKey, root.dataset.theme);
            } catch {}
        });
    }, { once: true });
})();
