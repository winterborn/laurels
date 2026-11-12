export interface Progress {
    achievementId: string;
    earned: boolean;
    value: number;
    target: number;
    // Set when earned: the watch that crossed the line.
    earnedAt?: number;
    eventId?: string;
    // Item whose poster stands for this trophy.
    posterKey?: string;
    // Short note, for example "Harbour Lights".
    note?: string;
}
