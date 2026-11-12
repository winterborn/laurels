import type {
    Achievement,
    Progress,
    Rule,
} from '../model/index.ts';
import {
    AwardsEvaluator,
    CompleteEvaluator,
    CountEvaluator,
    HoursEvaluator,
    SharedEvaluator,
    StreakEvaluator,
    WindowEvaluator,
} from './evaluators/index.ts';
import type { RuleResult } from './evaluators/index.ts';
import { HouseholdWatches } from './HouseholdWatches.ts';
import type { UserHistory } from './UserHistory.ts';

export class RuleEngine {

    private readonly awards = new AwardsEvaluator();
    private readonly complete = new CompleteEvaluator();
    private readonly count = new CountEvaluator();
    private readonly hours = new HoursEvaluator();
    private readonly shared = new SharedEvaluator();
    private readonly streak = new StreakEvaluator();
    private readonly window = new WindowEvaluator();

    // Awards rules go last, because they count the results of the other rules.
    evaluateAll(
        history: UserHistory,
        achievements: Achievement[],
        household = new HouseholdWatches(history.events),
    ): Progress[] {
        const watchRules = achievements.filter((achievement) => achievement.rule.type !== 'awards');
        const awardRules = achievements.filter((achievement) => achievement.rule.type === 'awards');
        const watchProgress = watchRules.map((achievement) => this.evaluate(history, achievement, household));
        const awardProgress = awardRules.map((achievement) => this.evaluateAwards(achievement, watchProgress));
        const all = [...watchProgress, ...awardProgress];
        const byId = new Map(all.map((progress) => [progress.achievementId, progress]));
        return achievements.map((achievement) => byId.get(achievement.id) as Progress);
    }

    // A broken rule is logged and shows as locked. It never stops the loop.
    evaluate(
        history: UserHistory,
        achievement: Achievement,
        household = new HouseholdWatches(history.events),
    ): Progress {
        return this.safely(achievement, () => this.evaluateRule(history, achievement.rule, household));
    }

    private evaluateAwards(achievement: Achievement, others: Progress[]): Progress {
        return this.safely(achievement, () => {
            if (achievement.rule.type !== 'awards') {
                throw new Error('not an awards rule');
            }
            return this.awards.evaluate(others, achievement.rule);
        });
    }

    private safely(achievement: Achievement, run: () => RuleResult): Progress {
        try {
            return {
                achievementId: achievement.id,
                ...run(),
            };
        } catch (error) {
            console.error(`Rule ${achievement.id} failed:`, error);
            return {
                achievementId: achievement.id,
                earned: false,
                value: 0,
                target: 1,
                failed: true,
            };
        }
    }

    private evaluateRule(history: UserHistory, rule: Rule, household: HouseholdWatches): RuleResult {
        switch (rule.type) {
            case 'awards':
                throw new Error('awards rules need the other results');
            case 'complete':
                return this.complete.evaluate(history, rule);
            case 'count':
                return this.count.evaluate(history, rule);
            case 'hours':
                return this.hours.evaluate(history, rule);
            case 'shared':
                return this.shared.evaluate(history, rule, household);
            case 'streak':
                return this.streak.evaluate(history, rule);
            case 'window':
                return this.window.evaluate(history, rule);
        }
    }

}
