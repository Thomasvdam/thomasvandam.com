import $ from './page-container.module.scss';

const PageContainer: React.FC = ({ children }) => {
    return <main className={$.container}>{children}</main>;
};

export default PageContainer;
