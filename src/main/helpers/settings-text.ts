// "1:Alex,2:Sam" -> Map { '1' => 'Alex', '2' => 'Sam' }
export function parseAliases(text: string): Map<string, string> {
    const pairs = parseList(text).map((entry) => {
        const [id, ...name] = entry.split(':');
        return [id.trim(), name.join(':').trim()] as [string, string];
    });
    return new Map(pairs);
}

// "Alex, Sam" -> ['Alex', 'Sam']
export function parseList(text: string): string[] {
    return text
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
}
