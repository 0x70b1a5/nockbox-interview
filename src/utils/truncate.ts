export function truncate(text: string, maxLength: number) {
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

export function trimAddress(address: string, startLength: number = 6, endLength: number = 4) {
    return address.length > startLength + endLength ? address.slice(0, startLength) + '...' + address.slice(-endLength) : address;
}