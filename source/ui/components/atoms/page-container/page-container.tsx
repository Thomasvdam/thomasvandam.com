import cx from '~source/utils/join-class-names';
import $ from './page-container.module.scss';

interface iProps {
    className?: string;
}

const PageContainer: React.FC<iProps> = ({ children, className }) => {
    return <main className={cx($.container, className)}>{children}</main>;
};

export default PageContainer;
