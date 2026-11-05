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
        const button = document.getElementById('theme-toggle');
        let switching = false;
        button.addEventListener('click', async () => {
            if (switching) return;
            const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
            const update = () => {
                applyTheme(nextTheme);
                try {
                    localStorage.setItem(storageKey, nextTheme);
                } catch {}
            };
            if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
                update();
                return;
            }
            const bounds = button.getBoundingClientRect();
            const x = bounds.left + bounds.width / 2;
            const y = bounds.top + bounds.height / 2;
            const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
            switching = true;
            let transition;
            const animations = document.getAnimations().filter(animation => animation.playState === 'running');
            animations.forEach(animation => animation.pause());
            root.classList.add('theme-switching');
            const skip = () => transition?.skipTransition();
            window.addEventListener('resize', skip, { passive: true });
            window.addEventListener('scroll', skip, { passive: true });
            try {
                transition = document.startViewTransition(update);
                await transition.ready;
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
                window.removeEventListener('resize', skip);
                window.removeEventListener('scroll', skip);
                root.classList.remove('theme-switching');
                animations.forEach(animation => {
                    if (animation.playState === 'paused') animation.play();
                });
                switching = false;
            }
        });
    }, { once: true });
})();
