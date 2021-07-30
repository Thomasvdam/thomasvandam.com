import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProxyExerciseProgress } from '~proxy-exercises/ui/hooks/use-proxy-exercise-progress';
import { paths } from '~source/domains/proxy-exercises/paths';

import $ from '../local-exercise.module.scss';

const expectedValue = 'This is pretty useful!';
const metaName = 'proxy_test';

export const MapHtml: React.FC = () => {
    const { exerciseState, markCompleted } = useProxyExerciseProgress();
    const completed = exerciseState.local.exercises.local_html;

    const [metaValue, setMetaValue] = useState<string>(null);
    const matchingMetaValue = metaValue === expectedValue;

    useEffect(() => {
        const metaTag = document.head.querySelector(`meta[name=${metaName}]`) as HTMLMetaElement;
        if (metaTag) {
            setMetaValue(metaTag.content);
        } else {
            setMetaValue(null);
        }
    }, []);

    useEffect(() => {
        if (matchingMetaValue) {
            markCompleted('local', 'local_html');
        }
    }, [markCompleted, matchingMetaValue]);

    return (
        <div>
            <h1 className={$.title}>Map local: html</h1>

            <p className={$.explanation}>
                Mapping files is not limited to requests that are done after the initial page has
                loaded, you can also map the HTML file that gets requested when you visit a page!
            </p>

            <p className={$.explanation}>
                Try using a proxy to map the request for this page to a local file on disk. Make
                sure to copy the contents of the original request and use that as a starting point.
                Add a meta tag to the &lt;head&gt; tag with the name &apos;{metaName}&apos; and
                reload the page.
            </p>

            {metaValue !== null && !matchingMetaValue && (
                <p className={$.explanation}>
                    Nice work! Now try setting the content attribute of the meta tag to &apos;
                    {expectedValue}&apos;
                </p>
            )}
            {metaValue !== null && matchingMetaValue && <p className={$.explanation}>Hey</p>}

            {completed && (
                <p className={$.completed}>
                    Congratulations, you completed the HTML exercise! This was the last in the map
                    local series.{' '}
                    <Link className={$.completed_link} to={paths.home}>
                        Go back to the exercise overview.
                    </Link>
                </p>
            )}
        </div>
    );
};

export default MapHtml;
