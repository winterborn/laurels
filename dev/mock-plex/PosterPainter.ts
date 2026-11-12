import type { PosterSource } from './MockLibrary.ts';

const PALETTES = [
    ['#1f2a44', '#e3b04b'],
    ['#5a1e1e', '#f3c48c'],
    ['#0f3b3a', '#dde6ed'],
    ['#2b2140', '#ef8a76'],
    ['#33302a', '#c9d1d9'],
    ['#14324f', '#f1c453'],
];

const LINE_LENGTH = 11;

// Draws a plain typographic poster for films with no real one.
export class PosterPainter {

    paint(source: PosterSource): string {
        const [background, ink] = this.paletteFor(source.title);
        const lines = this.wrap(source.title.toUpperCase());
        const titleSvg = lines
            .map((line, index) => this.titleLine(line, index, ink))
            .join('');
        const creditY = 300 + lines.length * 52;
        return [
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600">',
            `<rect width="400" height="600" fill="${background}"/>`,
            `<circle cx="200" cy="140" r="110" fill="none" stroke="${ink}" stroke-width="3" opacity="0.5"/>`,
            `<circle cx="200" cy="140" r="64" fill="${ink}" opacity="0.18"/>`,
            titleSvg,
            this.text(source.credit.toUpperCase(), creditY, 16, ink, 0.12),
            this.text(String(source.year), creditY + 26, 16, ink, 0.3),
            '</svg>',
        ].join('');
    }

    private titleLine(line: string, index: number, ink: string): string {
        const y = 300 + index * 52;
        return this.text(line, y, 52, ink, 0.02);
    }

    private text(
        value: string,
        y: number,
        size: number,
        ink: string,
        spacing: number,
    ): string {
        const safe = value
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;');
        return `<text x="200" y="${y}" text-anchor="middle" fill="${ink}" `
            + `font-family="Impact, 'League Gothic', 'Arial Narrow', sans-serif" `
            + `font-size="${size}" letter-spacing="${spacing}em">${safe}</text>`;
    }

    private wrap(title: string): string[] {
        const words = title.split(' ');
        return words.reduce<string[]>((lines, word) => {
            const last = lines[lines.length - 1];
            const fits = last !== undefined && (last + ' ' + word).length <= LINE_LENGTH;
            if (fits) {
                lines[lines.length - 1] = `${last} ${word}`;
            } else {
                lines.push(word);
            }
            return lines;
        }, []);
    }

    private paletteFor(title: string): string[] {
        const hash = [...title].reduce((sum, char) => sum + char.charCodeAt(0), 0);
        return PALETTES[hash % PALETTES.length];
    }

}
