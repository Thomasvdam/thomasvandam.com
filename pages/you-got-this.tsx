import { GetServerSideProps } from 'next';
import Head from 'next/head';
import YouGotThis from '~source/domains/you-got-this';
import parts from '../public/you-got-this/parts.json';

const getRandomPart = (part: keyof typeof parts): string => {
    const options = parts[part];
    // eslint-disable-next-line no-bitwise
    const index = (options.length * Math.random()) | 0;
    return options[index];
};

const buildMotivation = (): string => {
    const intro = getRandomPart('intro');
    const attribute = getRandomPart('attribute');
    const praise = getRandomPart('praise');
    const finisher = getRandomPart('finisher');

    return `${intro} ${attribute} ${praise} ${finisher}`;
};

interface iProps {
    motivation: string;
}

export const getServerSideProps: GetServerSideProps<iProps> = async () => {
    return {
        props: {
            motivation: buildMotivation(),
        },
    };
};

export default function HomePage({ motivation }: iProps) {
    return (
        <>
            <Head>
                <title>You got this!</title>
                <meta property="og:description" content="You can do it!" />
                <meta property="og:image" content="/you-got-this/you-got-this.png" />
            </Head>

            <YouGotThis motivation={motivation} />
        </>
    );
}
