import type { Achievement } from './Achievement.ts';

// A group of new awards, like a DLC pack on a console.
export interface Pack {
    id: string;
    name: string;
    description: string;
    awardIds: string[];
}

// The contents of one pack file, in achievements/packs or in the packs folder of /config.
export interface PackFile {
    id?: string;
    name?: string;
    description?: string;
    awards?: Array<Partial<Achievement>>;
}
