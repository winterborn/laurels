import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export class Output {

    readonly dir: string;
    private readonly secrets: string[];

    constructor(dir: string, secrets: string[]) {
        this.dir = dir;
        this.secrets = secrets.filter((secret) => secret.length > 0);
    }

    async init(): Promise<void> {
        await mkdir(join(this.dir, 'raw'), { recursive: true });
        await mkdir(join(this.dir, 'images'), { recursive: true });
    }

    async json(name: string, data: unknown): Promise<void> {
        const text = JSON.stringify(data, null, 2);
        await this.write(join('raw', `${name}.json`), text);
    }

    async report(text: string): Promise<void> {
        await this.write('findings.md', text);
    }

    async image(name: string, bytes: Uint8Array): Promise<void> {
        await writeFile(join(this.dir, 'images', name), bytes);
    }

    private async write(file: string, text: string): Promise<void> {
        const safeText = this.redact(text);
        await writeFile(join(this.dir, file), safeText);
    }

    private redact(text: string): string {
        return this.secrets.reduce(
            (result, secret) => result.replaceAll(secret, '[redacted]'),
            text,
        );
    }

}
