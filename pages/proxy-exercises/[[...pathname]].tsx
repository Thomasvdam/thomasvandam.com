import Head from 'next/head';
import App from '~proxy-exercises/ui/app';

export default function ProxyExerciseApp() {
    if (typeof window === 'undefined') {
        return (
            <div>
                <Head>
                    <title>Proxy Exercises</title>
                </Head>
            </div>
        );
    }

    return (
        <>
            <div suppressHydrationWarning>
                <Head>
                    <title>Proxy Exercises</title>
                </Head>

                <App />
            </div>
        </>
    );
}
