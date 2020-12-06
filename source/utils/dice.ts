import { d6 } from '~source/core/models';

export const rollD6 = (): d6 => {
    return (Math.floor(Math.random() * 6) + 1) as d6;
};
