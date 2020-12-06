import { useMemo } from 'react';
import { d6 } from '~source/core/models';
import cx from '~source/utils/join-class-names';
import $ from './die.module.scss';

interface iProps {
    angled?: boolean;
    className?: string;
    colour?: string;
    number: d6;
}

export const Die6: React.FC<iProps> = ({ angled, className, colour = '', number }) => {
    const dots = useMemo(() => {
        const tmp = [];
        for (let i = 0; i < number; i += 1) {
            tmp.push(<div key={i} className={$.die_dot} />);
        }

        return tmp;
    }, [number]);

    const angle = useMemo(() => {
        if (!angled) {
            return '';
        }

        const degree = Math.floor(Math.random() * 360) + 1;
        return `rotate(${degree}deg)`;
    }, [angled]);

    const styles = {
        backgroundColor: colour,
        transform: angle,
    };

    return (
        <div style={styles} className={cx($.die, $.die_6, className)}>
            {dots}
        </div>
    );
};
