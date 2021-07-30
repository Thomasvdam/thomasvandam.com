import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProxyExerciseProgress } from '~proxy-exercises/ui/hooks/use-proxy-exercise-progress';
import { paths } from '~source/domains/proxy-exercises/paths';

import $ from '../local-exercise.module.scss';

const steps = [
    { id: 0, value: 'This is step 1' },
    { id: 1, value: 'This is step 2' },
    { id: 9001, value: 'This is a meme' },
];

export const MapStatic: React.FC = () => {
    const { exerciseState, markCompleted } = useProxyExerciseProgress();
    const completed = exerciseState.local.exercises.local_static;

    const [error, setError] = useState<Error | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [retrievedState, setRetrievedState] = useState<{ id: number; value: string } | null>(
        null,
    );

    useEffect(() => {
        if (currentStep >= steps.length) return;

        const sameId = steps[currentStep].id === retrievedState?.id;
        const sameValue = steps[currentStep].value === retrievedState?.value;
        if (sameId && sameValue) {
            setCurrentStep((prev) => prev + 1);
        }
    }, [currentStep, retrievedState]);

    useEffect(() => {
        if (currentStep >= steps.length) {
            markCompleted('local', 'local_static');
        }
    }, [currentStep, markCompleted]);

    const fetchJson = useCallback(async () => {
        setError(null);
        setRetrievedState(null);

        fetch('/proxy-exercises/static.json')
            .then((res) => res.json())
            .catch((err) => {
                setError(err);
            })
            .then((value) => {
                setRetrievedState(value);
            });
    }, []);

    return (
        <div>
            <h1 className={$.title}>Map local: static file</h1>

            <p className={$.explanation}>
                When you press the button below the page will fetch a static json file from a
                server, parse the contents, and compare them with the expected value. You&apos;ll
                find that the file is pretty similar in structure to the expected response,
                it&apos;s just the values that are wrong.
            </p>

            <p className={$.explanation}>
                Try using a proxy to map the request to a local file on disk and start editing the
                values in the JSON. When it matches the expected values fetch the file again to see
                if it&apos;s correct.
            </p>

            <div className={$.progress}>
                Progress {currentStep}/{steps.length}
            </div>
            {completed && (
                <p className={$.completed}>
                    Congratulations, you completed the static files exercise!{' '}
                    <Link
                        className={$.completed_link}
                        to={paths.localExercise.replace(':exerciseKey', 'local_script')}
                    >
                        Go to the next exercise
                    </Link>
                </p>
            )}

            {currentStep < steps.length && (
                <>
                    <div>
                        <h4 className={$.label}>Expected response:</h4>
                        <pre className={$.json}>
                            {JSON.stringify(steps[currentStep], undefined, 4)
                                .split('\n')
                                .map((line, index) => {
                                    // eslint-disable-next-line react/no-array-index-key
                                    return <code key={index}>{line}</code>;
                                })}
                        </pre>
                    </div>
                    <div>
                        <h4 className={$.label}>Actual response:</h4>
                        {!error && retrievedState && (
                            <pre className={$.json}>
                                {JSON.stringify(retrievedState, undefined, 4)
                                    .split('\n')
                                    .map((line, index) => {
                                        // eslint-disable-next-line react/no-array-index-key
                                        return <code key={index}>{line}</code>;
                                    })}
                            </pre>
                        )}
                        {error && <pre className={$.error}>{error.message}</pre>}
                    </div>

                    <button type="button" onClick={fetchJson}>
                        Retrieve static file
                    </button>
                </>
            )}
        </div>
    );
};

export default MapStatic;
