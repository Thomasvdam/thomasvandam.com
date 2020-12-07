import Image from 'next/image';
import Link from 'next/link';
import { PageContainer } from '~source/ui/components/atoms';
import $ from './home-view.module.scss';

const HomeView: React.FC = () => {
    return (
        <div className={$.home}>
            <PageContainer>
                <h1 className={$.home_title}>This is my face</h1>
                <Image src="/images/catman.jpeg" alt="Who could it be?" height="300" width="300" />
                <p>Maybe I&apos;ll snazz it up in the future, who knows?</p>
                <p>
                    In the meantime, consider looking at this{' '}
                    <Link href="/polar-bears">
                        WIP of a game/riddle I like to annoy people with
                    </Link>
                    . Needs some serious design love, but as you might have guessed that&apos;s not
                    my strong suit.
                </p>
            </PageContainer>
        </div>
    );
};

export default HomeView;
