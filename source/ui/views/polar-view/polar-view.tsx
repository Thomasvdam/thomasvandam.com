import { useEffect, useState } from 'react';
import { d6 } from '~source/core/models';
import { Die6, Expander, PageContainer } from '~source/ui/components/atoms';
import $ from './polar-view.module.scss';

interface iProps {
    diceRolls: {
        roll: d6;
        colour: string;
    }[];
    nextRoll: number;
}

const getTimeText = (minutes: number): string => {
    if (minutes <= 0) {
        return 'A new roll is ready, refresh to check it out.';
    }

    const minuteWord = minutes === 1 ? 'minute' : 'minutes';
    const approxMinutes = Math.ceil(minutes / 5) * 5;
    return `Approximately ${approxMinutes} ${minuteWord} until the next roll.`;
};

const PolarView: React.FC<iProps> = ({ diceRolls, nextRoll }) => {
    const [minutes, setMinutes] = useState(0);
    const [update, setUpdate] = useState(() => 0);

    useEffect(() => {
        const intervalId = setInterval(() => {
            setUpdate((p) => p + 1);
        }, 300000);

        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        const currentTime = Date.now() / 1000;
        const timeDifferenceSec = nextRoll - currentTime;
        const timeDifferenceMin = Math.ceil(timeDifferenceSec / 60);
        setMinutes(timeDifferenceMin);
    }, [update]);

    return (
        <div className={$.polar}>
            <PageContainer className={$.polar_container}>
                <h1>Ice Holes and Polar Bears</h1>
                <section>
                    <p>Today&apos;s view of the Arctic is rather pretty don&apos;t you think?</p>
                </section>
                <section className={$.dice_container}>
                    {diceRolls.map((die, index) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <Die6 key={index} angled colour={die.colour} number={die.roll} />
                    ))}
                </section>
                <section>
                    <Expander
                        className={$.description_expander}
                        title={<h4 className={$.description_title}>What is this about?</h4>}
                    >
                        <p className={$.description_text}>
                            This is a simple game or riddle where you guess the number of ice holes
                            and polar bears present in a throw of the dice.
                        </p>
                        <p className={$.description_text}>
                            While this is certainly more fun to do in person and with actual dice, I
                            figured this would be a socially distant substitue. To inflate game
                            length a new roll is available every hour.
                        </p>
                    </Expander>
                </section>
                <section className={$.next_roll_container}>{getTimeText(minutes)}</section>
            </PageContainer>
        </div>
    );
};

export default PolarView;
