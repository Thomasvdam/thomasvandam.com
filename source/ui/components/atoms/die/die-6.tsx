import { useEffect, useMemo, useState } from 'react';
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
    const [styles, setStyles] = useState<Record<string, string>>({
        backgroundColor: colour,
    });

    const dots = useMemo(() => {
        const tmp = [];
        for (let i = 0; i < number; i += 1) {
            tmp.push(<div key={i} className={$.die_dot} />);
        }

        return tmp;
    }, [number]);

    useEffect(() => {
        if (!angled) {
            return;
        }

        const degree = Math.floor(Math.random() * 360) + 1;
        setStyles((prevStyles) => ({
            ...prevStyles,
            transform: `rotate(${degree}deg)`,
        }));
    }, [angled]);

    return (
        <div style={styles} className={cx($.die, $.die_6, className)}>
            {dots}
        </div>
    );
};
