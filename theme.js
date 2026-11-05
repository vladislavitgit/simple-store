(() => {
    const storageKey = 'simple-store-theme';
    const root = document.documentElement;
    function applyTheme(value, updateBrowser = true) {
        const dark = value === 'dark';
        root.dataset.theme = dark ? 'dark' : 'light';
        if (updateBrowser) document.querySelector('meta[name="theme-color"]').content = dark ? '#151219' : '#ffffff';
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
        const button = document.getElementById('theme-toggle');
        let switching = false;
        button.addEventListener('click', async () => {
            if (switching) return;
            const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
            const update = () => {
                applyTheme(nextTheme, !switching);
                try {
                    localStorage.setItem(storageKey, nextTheme);
                } catch {}
            };
            if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
                update();
                return;
            }
            switching = true;
            let transition;
            const animations = document.getAnimations().filter(animation => animation.playState === 'running');
            animations.forEach(animation => animation.pause());
            root.classList.add('theme-switching');
            const scrollX = window.scrollX;
            const scrollY = window.scrollY;
            const freezeScroll = scrollX !== 0 || scrollY !== 0;
            const header = document.querySelector('.header');
            const headerBounds = header.getBoundingClientRect();
            const bodyStyle = document.body.getAttribute('style');
            const headerStyle = header.getAttribute('style');
            const placeholder = document.createElement('div');
            const headerMargins = getComputedStyle(header);
            placeholder.style.height = `${headerBounds.height}px`;
            placeholder.style.marginTop = headerMargins.marginTop;
            placeholder.style.marginBottom = headerMargins.marginBottom;
            if (freezeScroll) {
                header.before(placeholder);
                Object.assign(document.body.style, {
                    position: 'fixed', top: `${-scrollY}px`, left: `${-scrollX}px`,
                    width: `${document.body.getBoundingClientRect().width}px`
                });
                Object.assign(header.style, {
                    position: 'fixed', top: `${headerBounds.top}px`, left: `${headerBounds.left}px`,
                    width: `${headerBounds.width}px`, margin: '0'
                });
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }
            const preventScroll = event => event.preventDefault();
            window.addEventListener('wheel', preventScroll, { passive: false });
            window.addEventListener('touchmove', preventScroll, { passive: false });
            try {
                await Promise.all(animations.map(animation => animation.ready.catch(() => {})));
                transition = document.startViewTransition(update);
                await transition.ready;
                const bounds = button.getBoundingClientRect();
                const snapshot = getComputedStyle(root, '::view-transition-group(root)');
                const matrix = new DOMMatrixReadOnly(snapshot.transform === 'none' ? undefined : snapshot.transform);
                const centerX = bounds.left + bounds.width / 2;
                const centerY = bounds.top + bounds.height / 2;
                const x = centerX - matrix.e - (parseFloat(snapshot.left) || 0);
                const y = centerY - matrix.f - (parseFloat(snapshot.top) || 0);
                const viewport = window.visualViewport;
                const width = Math.max(innerWidth, (viewport?.width || 0) + (viewport?.offsetLeft || 0));
                const height = Math.max(innerHeight, (viewport?.height || 0) + (viewport?.offsetTop || 0));
                const radius = Math.ceil(Math.hypot(Math.max(centerX, width - centerX), Math.max(centerY, height - centerY))) + 2;
                await root.animate({
                    clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]
                }, {
                    duration: 700,
                    easing: 'cubic-bezier(.4,0,.2,1)',
                    pseudoElement: '::view-transition-new(root)'
                }).finished;
                await transition.finished;
            } catch {
                transition?.skipTransition();
                if (root.dataset.theme !== nextTheme) update();
            } finally {
                window.removeEventListener('wheel', preventScroll);
                window.removeEventListener('touchmove', preventScroll);
                root.classList.remove('theme-switching');
                if (freezeScroll) {
                    placeholder.remove();
                    if (bodyStyle === null) document.body.removeAttribute('style');
                    else document.body.setAttribute('style', bodyStyle);
                    if (headerStyle === null) header.removeAttribute('style');
                    else header.setAttribute('style', headerStyle);
                    window.scrollTo({ top: scrollY, left: scrollX, behavior: 'instant' });
                }
                animations.forEach(animation => {
                    if (animation.playState === 'paused') animation.play();
                });
                switching = false;
                applyTheme(nextTheme);
            }
        });
    }, { once: true });
})();
