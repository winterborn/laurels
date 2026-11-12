// "a=1; b=2" -> Map { a => '1', b => '2' }
export function parseCookies(header: string | undefined): Map<string, string> {
    const pairs = (header ?? '')
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const index = part.indexOf('=');
            const name = part.slice(0, index);
            const value = decodeURIComponent(part.slice(index + 1));
            return [name, value] as [string, string];
        });
    return new Map(pairs);
}
