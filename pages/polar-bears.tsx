import { GetStaticProps } from 'next';
import Head from 'next/head';
import { PageContainer } from '~source/ui/components/atoms';
import { PolarView } from '~source/ui/views';
import { rollD6 } from '~source/utils/dice';
import { POLAR_BEARS_DICE_COUNT, POLAR_BEARS_REVALIDATION } from '~source/core/constants';
import { d6 } from '~source/core/models';

interface iProps {
    diceRolls: d6[];
}

export const getStaticProps: GetStaticProps<iProps> = async () => {
    const diceRolls: d6[] = [];
    for (let count = 0; count < POLAR_BEARS_DICE_COUNT; count += 1) {
        diceRolls.push(rollD6());
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

            <PageContainer>
                <PolarView diceRolls={diceRolls} />
            </PageContainer>
        </div>
    );
}
