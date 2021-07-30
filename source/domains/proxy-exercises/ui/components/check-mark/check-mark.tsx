import cx from '~source/utils/join-class-names';
import $ from './check-mark.module.scss';

export const CheckMark = ({ className = '' }) => {
    return <div className={cx($.check_mark, className)} />;
};
