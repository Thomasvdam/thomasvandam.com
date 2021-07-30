import cx from '~source/utils/join-class-names';
import $ from './check-mark.module.scss';

export const CheckMark = ({ checked = false, className = '' }) => {
    return <div className={cx($.check_mark, checked && $.checked, className)} />;
};
