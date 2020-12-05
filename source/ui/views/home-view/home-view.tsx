import Image from 'next/image';

import $ from './home-view.module.scss';

const HomeView: React.FC = () => {
    return (
        <div className={$.home}>
            <h1>This is my face</h1>
            <Image src="/images/catman.jpeg" alt="Who could it be?" height="300" width="300" />
            <p>Maybe I&apos;ll snazz it up in the future, who knows?</p>
        </div>
    );
};

export default HomeView;
