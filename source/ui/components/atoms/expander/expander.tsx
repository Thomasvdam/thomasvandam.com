import { ReactElement, useEffect, useState } from 'react';
import cx from '~source/utils/join-class-names';
import { uniqueId } from '~source/utils/unique-id';
import $ from './expander.module.scss';

interface iProps {
    className?: string;
    title: ReactElement;
    startOpen?: boolean;
}

export const Expander: React.FC<iProps> = ({ children, className, title, startOpen = false }) => {
    const [id, setId] = useState('');

    useEffect(() => {
        setId(uniqueId('label-'));
    }, []);

    return (
        <div className={cx($.expander_wrapper, className)}>
            <input
                id={id}
                className={$.expander_toggle}
                type="checkbox"
                defaultChecked={startOpen}
            />
            <label htmlFor={id} className={$.expander_label}>
                {title}
            </label>
            <div className={$.expander_content}>{children}</div>
        </div>
    );
};
