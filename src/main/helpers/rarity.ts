// Below this many people, a percentage says too much about each person.
export const MIN_PEOPLE_FOR_SHARE = 5;

// Share of the household with a trophy, 0 to 1. Null when hidden.
export function householdShare(earnedBy: number, people: number): number | null {
    if (people < MIN_PEOPLE_FOR_SHARE) {
        return null;
    }
    return earnedBy / people;
}
