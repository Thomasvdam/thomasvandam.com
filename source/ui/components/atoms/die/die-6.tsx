import { useMemo } from 'react';
import { POLAR_BEARS_DICE_COLOURS } from '~source/core/constants';
import { d6 } from '~source/core/models';
import cx from '~source/utils/join-class-names';
import $ from './die.module.scss';

interface iProps {
    className?: string;
    colour?: string;
    number: d6;
}

export const Die6: React.FC<iProps> = ({ className, colour = '', number }) => {
    const dots = useMemo(() => {
        const tmp = [];
        for (let i = 0; i < number; i += 1) {
            tmp.push(
                <span key={i} className={$.die_dot}>
                    •
                </span>,
            );
        }

        return tmp;
    }, [number]);

    const styles = {
        backgroundColor: colour,
    };

    return (
        <div style={styles} className={cx($.die, $.die_6, className)}>
            {dots}
        </div>
    );
};
