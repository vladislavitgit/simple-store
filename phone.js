export function phoneDigits(value) {
    const digits = value.replace(/\D/g, '');
    const hasPrefix = /^\+7/.test(value) || (digits.length > 10 && /^[78]/.test(digits));
    return (hasPrefix ? digits.slice(1) : digits).slice(0, 10);
}

export function formatPhoneNumber(digits) {
    if (!digits) return '';
    let value = `(${digits.slice(0, 3)}`;
    if (digits.length >= 3) value += ')';
    if (digits.length > 3) value += ` ${digits.slice(3, 6)}`;
    if (digits.length > 6) value += `-${digits.slice(6, 8)}`;
    if (digits.length > 8) value += `-${digits.slice(8, 10)}`;
    return value;
}

export function initializePhoneInput(input) {
    function update(digits, position) {
        input.value = formatPhoneNumber(digits);
        if (document.activeElement !== input) return;
        let caret = 0;
        let count = 0;
        while (caret < input.value.length && count < position) {
            if (/\d/.test(input.value[caret])) count++;
            caret++;
        }
        if (position >= digits.length) caret = input.value.length;
        input.setSelectionRange(caret, caret);
    }
    function normalize() {
        if (!input.value) return;
        const raw = input.value.replace(/\D/g, '');
        const prefix = /^\+7/.test(input.value) || (raw.length > 10 && /^[78]/.test(raw)) ? 1 : 0;
        const position = input.value.slice(0, input.selectionStart).replace(/\D/g, '').length - prefix;
        update(phoneDigits(input.value), Math.max(0, position));
    }
    input.addEventListener('input', normalize);
    input.addEventListener('change', normalize);
    input.addEventListener('beforeinput', event => {
        const start = input.selectionStart;
        const end = Math.max(start, input.selectionEnd);
        if (!['deleteContentBackward', 'deleteContentForward'].includes(event.inputType)) return;
        event.preventDefault();
        const digits = phoneDigits(input.value);
        const position = input.value.slice(0, start).replace(/\D/g, '').length;
        if (start !== end) {
            const endPosition = input.value.slice(0, end).replace(/\D/g, '').length;
            update(digits.slice(0, position) + digits.slice(endPosition), position);
            return;
        }
        const deleteIndex = event.inputType === 'deleteContentBackward' ? position - 1 : position;
        if (deleteIndex >= 0 && deleteIndex < digits.length) {
            update(digits.slice(0, deleteIndex) + digits.slice(deleteIndex + 1), deleteIndex);
        }
    });
    input.addEventListener('paste', event => {
        const text = event.clipboardData.getData('text');
        if (text.replace(/\D/g, '').length < 10) return;
        event.preventDefault();
        const digits = phoneDigits(text);
        update(digits, digits.length);
    });
    input.addEventListener('blur', () => {
        if (!phoneDigits(input.value)) input.value = '';
    });
    normalize();
}
