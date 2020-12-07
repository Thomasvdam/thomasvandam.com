import { iDiceRoll, iSolution } from '~source/core/models';

export const getBearsSolution = (diceRolls: iDiceRoll[]): iSolution => {
    return diceRolls.reduce(
        (acc, diceRoll) => {
            const { roll } = diceRoll;
            const iceHole = roll % 2;
            if (!iceHole) return acc;

            acc.iceHoles += iceHole;
            acc.bears += roll - 1;

            return acc;
        },
        { bears: 0, iceHoles: 0 } as iSolution,
    );
};
