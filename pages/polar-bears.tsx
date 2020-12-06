import { GetStaticProps } from 'next';
import Head from 'next/head';
import { PolarView } from '~source/ui/views';
import {
    POLAR_BEARS_DICE_COLOURS,
    POLAR_BEARS_DICE_COUNT,
    POLAR_BEARS_REVALIDATION,
} from '~source/core/constants';
import { d6 } from '~source/core/models';
import { rollD6 } from '~source/utils/dice';
import { createPool } from '~source/utils/draw-from-pool';

interface diceRoll {
    roll: d6;
    colour: string;
}

interface iProps {
    diceRolls: diceRoll[];
}

export const getStaticProps: GetStaticProps<iProps> = async () => {
    const drawColour = createPool([...POLAR_BEARS_DICE_COLOURS]);

    const diceRolls: diceRoll[] = [];
    for (let count = 0; count < POLAR_BEARS_DICE_COUNT; count += 1) {
        const roll = rollD6();
        const colour = drawColour();
        diceRolls.push({
            roll,
            colour,
        });
    }

    return {
        props: {
            diceRolls,
        },
        revalidate: POLAR_BEARS_REVALIDATION,
    };
};

export default function PolarBears({ diceRolls }: iProps) {
    return (
        <div>
            <Head>
                <title>Ice Holes and Polar Bears</title>
            </Head>

            <PolarView diceRolls={diceRolls} />
        </div>
    );
}
