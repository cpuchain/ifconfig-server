export function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function pad(n: number): string {
    return n < 10 ? '0' + n : n.toString();
}

export function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1); // Months are zero indexed
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    const matched = date.toString().match(/GMT[+-]\d{4}/);
    const timezone = matched?.[0] || '';

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}${timezone ? ` ${timezone}` : ''}`;
}
