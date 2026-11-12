import type { WatchEvent } from '../model/index.ts';

export interface TallyLeader {
    group: string;
    size: number;
}

// Counts members per group and remembers the first group to reach the target.
export class Tally {

    private readonly target: number;
    private readonly groups = new Map<string, Set<string>>();
    private crossingEvent: WatchEvent | undefined;
    private crossingGroup: string | undefined;

    constructor(target: number) {
        this.target = target;
    }

    add(group: string, member: string, event: WatchEvent): void {
        const members = this.groups.get(group) ?? new Set<string>();
        members.add(member);
        this.groups.set(group, members);
        const isFirstCrossing = !this.crossingEvent && members.size >= this.target;
        if (isFirstCrossing) {
            this.crossingEvent = event;
            this.crossingGroup = group;
        }
    }

    get crossing(): WatchEvent | undefined {
        return this.crossingEvent;
    }

    get leader(): TallyLeader {
        if (this.crossingGroup) {
            return {
                group: this.crossingGroup,
                size: this.target,
            };
        }
        return this.largestGroup();
    }

    private largestGroup(): TallyLeader {
        const entries = [...this.groups.entries()];
        const sizes = entries.map(([group, members]) => ({
            group,
            size: members.size,
        }));
        const empty = {
            group: '',
            size: 0,
        };
        return sizes.reduce((best, entry) => (entry.size > best.size ? entry : best), empty);
    }

}
