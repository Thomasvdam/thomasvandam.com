import { d6 } from '.';

export interface iDiceRoll {
    roll: d6;
    colour: string;
}

export interface iSolution {
    bears: number;
    iceHoles: number;
}
