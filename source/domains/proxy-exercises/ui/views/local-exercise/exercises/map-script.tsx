import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProxyExerciseProgress } from '~proxy-exercises/ui/hooks/use-proxy-exercise-progress';
import { paths } from '~source/domains/proxy-exercises/paths';
import { CodeBlock } from '~proxy-exercises/ui/components';

import $ from '../local-exercise.module.scss';

const EXPECTED_TITLE = 'All your titles are belong to us';
const EXPECTED_HREF = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const steps = [
    {
        explanation: (
            <p>
                Change the heading of this page to &quot;{EXPECTED_TITLE}&quot;. Do not include the
                double quotation marks. There&apos;s an id on the element to make it a little
                easier.
            </p>
        ),
        onSuccess: <p>Nicely done!</p>,
        verify: () => document.querySelector('#map_script_heading')?.innerHTML === EXPECTED_TITLE,
    },
    {
        explanation: (
            <p>
                Chances are you noticed an anchor tag in the DOM that&apos;s not currently visible.
                Update the script to make the tag visible by removing the attribute and set the href
                attribute to &quot; Again, there&apos;s an id on the element to make it a little
                easier.
            </p>
        ),
        onSuccess: <p>You&apos;re getting the hang of this!</p>,
        verify: () => {
            const button = document.querySelector<HTMLAnchorElement | null>('#big_red_button');
            if (!button) return false;

            const hasDisabled = button.hasAttribute('data-disabled');
            return !hasDisabled && button.href === EXPECTED_HREF;
        },
    },
    {
        explanation: <p>Don&apos;t forget to click the button!</p>,
        onSuccess: <p />,
        verify: () => false,
    },
];

export const MapScript: React.FC = () => {
    const { exerciseState, markCompleted } = useProxyExerciseProgress();
    const completed = exerciseState.local.exercises.local_script;

    const [currentStep, setCurrentStep] = useState(0);
    const [stepCompleted, setStepCompleted] = useState(false);
    const [clickedBigButton, setClickedBigButton] = useState(false);

    const goToNextStep = useCallback(() => {
        if (currentStep + 1 >= steps.length) {
            markCompleted('local', 'local_script');
        }

        setStepCompleted(false);
        setCurrentStep((prev) => prev + 1);
    }, [currentStep, markCompleted]);

    const [error, setError] = useState<Error | null>(null);
    const [currentScript, setCurrentScript] = useState<string | null>(null);

    const fetchScript = useCallback(async () => {
        setError(null);
        setCurrentScript(null);

        fetch('/proxy-exercises/bundle.js')
            .then((res) => res.text())
            .catch((err) => {
                setError(err);
            })
            .then((value) => {
                if (!value) {
                    setError(new Error('Empty script'));
                    return;
                }

                setCurrentScript(value);
                const scriptTag = document.createElement('script');
                scriptTag.innerHTML = value;
                document.body.append(scriptTag);
            });
    }, []);

    useEffect(() => {
        setStepCompleted(steps[currentStep].verify());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentScript]);

    const onBigButtonClick = useCallback(() => {
        if (!clickedBigButton) {
            setClickedBigButton(true);
            setStepCompleted(true);
            setCurrentStep((prev) => prev + 1);
        }
    }, [clickedBigButton]);

    return (
        <div>
            <h1 id="map_script_heading" className={$.title}>
                Map local: script files
            </h1>

            <p className={$.explanation}>
                When you press the button below the page will fetch a js file from a server and add
                the contents to the page, in turn evaluating the script. In this exercise
                you&apos;re required to modify elements in the current page through the script. In a
                real scenario the file will often be requested during the initial load of the page,
                but this setup makes it a little easier to figure out how to set up the proxy.
            </p>

            <p className={$.explanation}>
                Try using a proxy to map the request to a local file on disk and start editing the
                script. When you&apos;re done editing you can fetch the file again.
            </p>

            <div className={$.progress}>
                Progress {currentStep}/{steps.length}
            </div>

            <div>
                {currentStep < steps.length && (
                    <>
                        <h4 className={$.label}>Step {currentStep + 1}:</h4>
                        {steps[currentStep].explanation}
                        {stepCompleted ? (
                            <div>
                                {steps[currentStep].onSuccess}
                                <button type="button" onClick={goToNextStep}>
                                    Proceed
                                </button>
                            </div>
                        ) : (
                            <button type="button" onClick={fetchScript}>
                                Load JS file.
                            </button>
                        )}
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a
                            className={$.big_red_button}
                            href=""
                            id="big_red_button"
                            onClick={onBigButtonClick}
                            rel="noopener noreferrer"
                            data-disabled
                            target="_blank"
                        >
                            Click me
                        </a>
                    </>
                )}
                {completed && (
                    <p className={$.completed}>
                        Congratulations, you completed the script files exercise!{' '}
                        <Link
                            className={$.completed_link}
                            to={paths.localExercise.replace(':exerciseKey', 'local_html')}
                        >
                            Go to the next exercise
                        </Link>
                    </p>
                )}
            </div>
            <div>
                <h4 className={$.label}>Loaded script:</h4>
                {!error && <CodeBlock contents={currentScript} />}
                {error && <pre className={$.error}>{error.message}</pre>}
            </div>
        </div>
    );
};

export default MapScript;
