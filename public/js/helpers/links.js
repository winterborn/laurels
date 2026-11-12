// One route for each page, named like its menu label.

export function awardsLink(userId) {
    return `#/awards/${encodeURIComponent(userId)}`;
}

export function ballotLink(userId) {
    return `#/ballot/${encodeURIComponent(userId)}`;
}

export function awardLink(achievementId, userId) {
    return `#/award/${encodeURIComponent(achievementId)}/${encodeURIComponent(userId)}`;
}

export function seasonLink(userId, year) {
    const yearPart = year ? `/${encodeURIComponent(year)}` : '';
    return `#/season/${encodeURIComponent(userId)}${yearPart}`;
}
