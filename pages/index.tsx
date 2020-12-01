import Head from 'next/head';
import { Home } from '~source/ui/views';

export default function HomePage() {
    return (
        <div>
            <Head>
                <title>Home</title>
            </Head>

            <main>
                <Home />
            </main>
        </div>
    );
}
