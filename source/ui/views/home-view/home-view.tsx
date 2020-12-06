import Image from 'next/image';
import { PageContainer } from '~source/ui/components/atoms';
import $ from './home-view.module.scss';

const HomeView: React.FC = () => {
    return (
        <div className={$.home}>
            <PageContainer>
                <h1 className={$.home_title}>This is my face</h1>
                <Image src="/images/catman.jpeg" alt="Who could it be?" height="300" width="300" />
                <p>Maybe I&apos;ll snazz it up in the future, who knows?</p>
            </PageContainer>
        </div>
    );
};

export default HomeView;
