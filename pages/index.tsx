import Head from 'next/head';
import { PageContainer } from '~source/ui/components/atoms';
import { HomeView } from '~source/ui/views';

export default function HomePage() {
    return (
        <div>
            <Head>
                <title>Home</title>
            </Head>

            <PageContainer>
                <HomeView />
            </PageContainer>
        </div>
    );
}
