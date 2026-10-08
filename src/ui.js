// src/ui.js

let spinnerInterval = null;

const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function startSpinner(text = 'Processing...') {
    let i = 0;
    console.log();
    spinnerInterval = setInterval(() => {
        process.stdout.write(`\r${spinnerChars[i]} ${text}`);
        i = (i + 1) % spinnerChars.length;
    }, 80);

    return () => stopSpinner();
}

export function stopSpinner(success = true) {
    if (spinnerInterval) {
        clearInterval(spinnerInterval);
        spinnerInterval = null;
    }
    process.stdout.write('\r'); // Clear spinner line
    if (success) {
        console.log('✅ Done\n');
    } else {
        console.log('❌ Failed\n');
    }
}

export function createProgressBar(total, text = '') {
    let current = 0;

    const update = (increment = 1, statusText = '') => {
        current += increment;
        const percent = Math.min(100, Math.round((current / total) * 100));
        const filled = Math.round((percent / 100) * 30);
        const empty = 30 - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        process.stdout.write(`\r[${bar}] ${percent}% ${statusText}`);
        if (current >= total) {
            console.log(); // New line when complete
        }
    };

    const done = () => {
        update(0, '');
    };

    return { update, done };
}