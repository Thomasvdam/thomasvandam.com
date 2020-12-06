import { d6 } from '~source/core/models';
import $ from './die.module.scss';

interface iProps {
    number: d6;
}

export const Die6: React.FC<iProps> = ({ number }) => {
    return <div className={$.die}>{number}</div>;
};
