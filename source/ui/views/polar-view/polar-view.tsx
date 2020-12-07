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

const getHoursText = (hours: number): string => {
    if (hours <= 0) {
        return 'A new roll is ready, refresh to check it out.';
    }

    const hourWord = hours === 1 ? 'hour' : 'hours';
    return `Approximately ${hours} ${hourWord} until the next roll.`;
};

const PolarView: React.FC<iProps> = ({ diceRolls, nextRoll }) => {
    const [hours, setHours] = useState(0);
    const [update, setUpdate] = useState(() => 0);

    useEffect(() => {
        const intervalId = setInterval(() => {
            setUpdate((p) => p + 1);
        }, 1800000);

        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        const currentTime = Date.now() / 1000;
        const timeDifferenceSec = nextRoll - currentTime;
        const timeDifferenceHrs = Math.ceil(timeDifferenceSec / 60 / 60);
        setHours(timeDifferenceHrs);
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
                            \// TODO: A short text about the riddle.
                        </p>
                    </Expander>
                </section>
                <section className={$.next_roll_container}>{getHoursText(hours)}</section>
            </PageContainer>
        </div>
    );
};

export default PolarView;
