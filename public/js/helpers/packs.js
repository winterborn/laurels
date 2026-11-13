const DAY_SECONDS = 86_400;
// A pack shows "New" for 30 days. The Awards page shows its note for 14 days.
const NEW_DAYS = 30;
const NOTE_DAYS = 14;

// True when the pack arrived on this server in the last `days` days.
// A pack that was there from the start (arrivedAt null) is never new.
export function isNewPack(pack, days = NEW_DAYS) {
    if (!pack?.arrivedAt) {
        return false;
    }
    const age = Date.now() / 1000 - pack.arrivedAt;
    return age < days * DAY_SECONDS;
}

// The packs for the note on the Awards page, newest first.
export function recentPacks(packs) {
    return packs.filter((pack) => isNewPack(pack, NOTE_DAYS));
}

// Each award gets the pack that added it, or null.
export function withPacks(definitionList, packs) {
    const byId = new Map(packs.map((pack) => [pack.id, pack]));
    return definitionList.map((definition) => ({
        ...definition,
        packInfo: byId.get(definition.pack) ?? null,
    }));
}
