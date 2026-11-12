export type Verdict = 'ok' | 'check' | 'fail' | 'info';

export interface Finding {
    question: string;
    answer: string;
    verdict: Verdict;
}

export class Findings {

    private readonly sections = new Map<string, Finding[]>();

    add(
        section: string,
        question: string,
        answer: string,
        verdict: Verdict,
    ): void {
        const list = this.sections.get(section) ?? [];
        list.push({
            question,
            answer,
            verdict,
        });
        this.sections.set(section, list);
    }

    toMarkdown(title: string, context: string[]): string {
        const lines = [`# ${title}`, '', ...context, ''];
        for (const [section, findings] of this.sections) {
            lines.push(...this.renderSection(section, findings));
        }
        return lines.join('\n');
    }

    private renderSection(section: string, findings: Finding[]): string[] {
        const rows = findings.map((finding) => this.renderRow(finding));
        return [
            `## ${section}`,
            '',
            '| Check | Result | Verdict |',
            '|---|---|---|',
            ...rows,
            '',
        ];
    }

    private renderRow(finding: Finding): string {
        const question = this.cell(finding.question);
        const answer = this.cell(finding.answer);
        return `| ${question} | ${answer} | ${finding.verdict} |`;
    }

    private cell(text: string): string {
        return text
            .replaceAll('|', '\\|')
            .replaceAll('\n', ' ');
    }

}
