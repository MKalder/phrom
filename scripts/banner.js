import { styleText } from 'node:util';

const BANNER = `
██████╗ ██╗  ██╗██████╗  ██████╗ ███╗   ███╗
██╔══██╗██║  ██║██╔══██╗██╔═══██╗████╗ ████║
██████╔╝███████║██████╔╝██║   ██║██╔████╔██║
██╔═══╝ ██╔══██║██╔══██╗██║   ██║██║╚██╔╝██║
██║     ██║  ██║██║  ██║╚██████╔╝██║ ╚═╝ ██║
╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝
`;

const depth = process.stdout.getColorDepth?.() ?? 1;

// one love 🇹🇭
const THAI_STRIPES = [
    { rgb: [165, 25, 49], c256: 124, fallback: 'red' },
    { rgb: [244, 245, 248], c256: 255, fallback: 'white' },
    { rgb: [3, 42, 157], c256: 19, fallback: 'blue' },  // #032a9d
    { rgb: [3, 42, 157], c256: 19, fallback: 'blue' },
    { rgb: [244, 245, 248], c256: 255, fallback: 'white' },
    { rgb: [165, 25, 49], c256: 124, fallback: 'red' },
];

function paintStripe(stripe, text) {
    if (depth >= 24) return `\x1b[38;2;${stripe.rgb.join(';')}m${text}\x1b[39m`;
    if (depth >= 8) return `\x1b[38;5;${stripe.c256}m${text}\x1b[39m`;
    return styleText(stripe.fallback, text);
}

export function printBanner(version = '1.0.0') {
    const indent = '  ';
    const rows = BANNER.split('\n').filter(Boolean);

    console.log();
    rows.forEach((row, i) => {
        console.log(indent + paintStripe(THAI_STRIPES[i % THAI_STRIPES.length], row));
    });

    console.log();
    console.log(
        `${indent}${styleText('bold', 'พร้อม')} ${styleText('dim', '·')} AI-assisted backlog refinement`
    );
    console.log(`${indent}${styleText('dim', `Demo v${version}`)}\n`);
}