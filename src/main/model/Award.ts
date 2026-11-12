export interface Award {
    userId: string;
    achievementId: string;
    awardedAt: number;
    eventId: string;
    posterKey: string;
    note: string;
    notifiedAt?: number;
    // When Laurels gave the award. awardedAt is the date of the watch.
    grantedAt?: number;
}
