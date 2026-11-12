import type {
    Achievement,
    Progress,
    Rule,
} from '../model/index.ts';
import {
    CompleteEvaluator,
    CountEvaluator,
    HoursEvaluator,
    StreakEvaluator,
    WindowEvaluator,
} from './evaluators/index.ts';
import type { RuleResult } from './evaluators/index.ts';
import type { UserHistory } from './UserHistory.ts';

export class RuleEngine {

    private readonly count = new CountEvaluator();
    private readonly hours = new HoursEvaluator();
    private readonly complete = new CompleteEvaluator();
    private readonly streak = new StreakEvaluator();
    private readonly window = new WindowEvaluator();

    evaluateAll(history: UserHistory, achievements: Achievement[]): Progress[] {
        return achievements.map((achievement) => this.evaluate(history, achievement));
    }

    // A broken rule is logged and shows as locked. It never stops the loop.
    evaluate(history: UserHistory, achievement: Achievement): Progress {
        try {
            const result = this.evaluateRule(history, achievement.rule);
            return {
                achievementId: achievement.id,
                ...result,
            };
        } catch (error) {
            console.error(`Rule ${achievement.id} failed:`, error);
            return {
                achievementId: achievement.id,
                earned: false,
                value: 0,
                target: 1,
            };
        }
    }

    private evaluateRule(history: UserHistory, rule: Rule): RuleResult {
        switch (rule.type) {
            case 'count':
                return this.count.evaluate(history, rule);
            case 'hours':
                return this.hours.evaluate(history, rule);
            case 'complete':
                return this.complete.evaluate(history, rule);
            case 'streak':
                return this.streak.evaluate(history, rule);
            case 'window':
                return this.window.evaluate(history, rule);
        }
    }

}
