import type { PosterSigner } from '../auth/index.ts';
import type {
    Achievement,
    Award,
    User,
} from '../model/index.ts';
import {
    groupBy,
    TIER_COLOURS,
    TIER_POINTS,
    TIER_WORDS,
} from '../helpers/index.ts';

export interface AwardNotice {
    award: Award;
    achievement: Achievement;
    user: User;
    // Title of the film or show that earned it.
    earnedWith: string;
}

type Embed = Record<string, unknown>;

// More new trophies than this for one person in one sync: one summary message.
const SUMMARY_FROM = 4;

// Posts awards to a Discord channel. Does nothing without a webhook URL.
export class DiscordNotifier {

    private readonly webhookUrl: string;
    private readonly publicUrl: string;
    private readonly signer: PosterSigner;

    constructor(webhookUrl: string, publicUrl: string, signer: PosterSigner) {
        this.webhookUrl = webhookUrl;
        this.publicUrl = publicUrl;
        this.signer = signer;
    }

    get isEnabled(): boolean {
        return this.webhookUrl !== '';
    }

    // One message per trophy, or one summary per person when there are many.
    async sendAll(notices: AwardNotice[]): Promise<void> {
        if (!this.isEnabled) {
            return;
        }
        const byUser = groupBy(notices, (notice) => notice.user.id);
        for (const own of byUser.values()) {
            if (own.length >= SUMMARY_FROM) {
                await this.post(this.summaryEmbed(own));
            } else {
                for (const notice of own) {
                    await this.post(this.awardEmbed(notice));
                }
            }
        }
    }

    // Settings page "Send test message" button.
    async sendTest(): Promise<void> {
        if (!this.isEnabled) {
            throw new Error('Add a Discord webhook URL first.');
        }
        await this.post({
            title: 'Winner: Test screening',
            description: 'Laurels can post to this channel.',
            color: this.colourOf('Rare'),
        });
    }

    private async post(embed: Embed): Promise<void> {
        const response = await fetch(this.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: 'Laurels',
                embeds: [embed],
            }),
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
            throw new Error(`Discord returned ${response.status}`);
        }
    }

    // "Alex / Winner: Night shift / Watch 25 horror films. / The lights stay on now."
    private awardEmbed(notice: AwardNotice): Embed {
        const { achievement, award, user } = notice;
        const flavour = achievement.flavorText ? `\n*${achievement.flavorText}*` : '';
        return {
            author: {
                name: user.name,
            },
            title: `${TIER_WORDS[achievement.tier]}: ${achievement.title}`,
            description: `${achievement.description}${flavour}`,
            color: this.colourOf(achievement.tier),
            fields: this.fields(notice),
            thumbnail: this.thumbnail(award),
            timestamp: new Date(award.awardedAt * 1000).toISOString(),
        };
    }

    private fields(notice: AwardNotice): Embed[] {
        const fields = [
            {
                name: 'Tier',
                value: TIER_WORDS[notice.achievement.tier],
                inline: true,
            },
            {
                name: 'Points',
                value: String(TIER_POINTS[notice.achievement.tier]),
                inline: true,
            },
        ];
        if (!notice.earnedWith) {
            return fields;
        }
        return [
            ...fields,
            {
                name: 'Earned with',
                value: notice.earnedWith,
                inline: true,
            },
        ];
    }

    // "4 premieres for Alex", one line per trophy.
    private summaryEmbed(notices: AwardNotice[]): Embed {
        const user = notices[0].user;
        const lines = notices.map((notice) => {
            return `${TIER_WORDS[notice.achievement.tier]}: **${notice.achievement.title}**`;
        });
        const best = [...notices].sort((a, b) => TIER_POINTS[b.achievement.tier] - TIER_POINTS[a.achievement.tier])[0];
        return {
            author: {
                name: user.name,
            },
            title: `${notices.length} premieres for ${user.name}`,
            description: lines.join('\n'),
            color: this.colourOf(best.achievement.tier),
            thumbnail: this.thumbnail(best.award),
        };
    }

    private colourOf(tier: Achievement['tier']): number {
        return Number.parseInt(TIER_COLOURS[tier].slice(1), 16);
    }

    // Discord can show the poster only if it can reach Laurels.
    // Discord has no session, so the link carries a signature.
    private thumbnail(award: Award): Embed | undefined {
        if (!this.publicUrl) {
            return undefined;
        }
        const segment = encodeURIComponent(award.posterKey);
        const signature = this.signer.signatureOf(segment);
        return {
            url: `${this.publicUrl}/api/poster/${segment}?sig=${signature}`,
        };
    }

}
