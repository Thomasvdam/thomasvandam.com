import Head from 'next/head';
import { HomeView } from '~source/ui/views';

export default function HomePage() {
    return (
        <>
            <Head>
                <title>Home</title>
            </Head>

            <HomeView />
        </>
    );
}
