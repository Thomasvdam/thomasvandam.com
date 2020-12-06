export const createPool = <T>(pool: T[]): (() => T | null) => {
    return () => {
        if (pool.length === 0) return null;

        const index = Math.floor(Math.random() * pool.length);
        const item = pool[index];
        pool.splice(index, 1);
        return item;
    };
};
