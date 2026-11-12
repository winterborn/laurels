import type {
    Progress,
    Rule,
} from '../../model/index.ts';
import type { UserHistory } from '../UserHistory.ts';

export type RuleResult = Omit<Progress, 'achievementId'>;

export interface Evaluator<R extends Rule> {
    evaluate(history: UserHistory, rule: R): RuleResult;
}
