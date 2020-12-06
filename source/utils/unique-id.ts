let idCounter = 0;
export const uniqueId = (prefix: string): string => {
    const id = idCounter;
    idCounter += 1;
    return `${prefix}${id}`;
};
