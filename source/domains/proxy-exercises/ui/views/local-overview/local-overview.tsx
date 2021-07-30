import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '~source/ui/components';
import { paths } from '~source/domains/proxy-exercises/paths';
import { useProxyExerciseProgress } from '~proxy-exercises/ui/hooks/use-proxy-exercise-progress';
import { CheckMark } from '~proxy-exercises/ui/components';
import { iProxyExerciseKey } from '~source/domains/proxy-exercises/models';

import $ from './local-overview.module.scss';

const exerciseTitles: Record<iProxyExerciseKey, string> = {
    local_static: 'Map local: static file',
    local_script: 'Map local: script',
    local_html: 'Map local: HTML',
};

export const LocalOverview: React.FC = () => {
    const { exerciseState } = useProxyExerciseProgress();
    const localGroup = exerciseState.local;

    const groupKeys = useMemo(() => {
        return Object.keys(localGroup.exercises);
    }, [localGroup]);

    return (
        <PageContainer>
            <h1 className={$.title}>Map Local Overview</h1>

            <p className={$.text}>A short text about how and when to use map local.</p>

            <ol className={$.groups_container}>
                {groupKeys.map((exerciseKey) => {
                    return (
                        <Link
                            key={exerciseKey}
                            className={$.link}
                            to={paths.localExercise.replace(':exerciseKey', exerciseKey)}
                        >
                            <li className={$.exercise_item}>
                                <div className={$.exercise_container}>
                                    <span className={$.exercise_title}>
                                        {exerciseTitles[exerciseKey]}
                                    </span>
                                    <CheckMark checked={localGroup[exerciseKey]} />
                                </div>
                            </li>
                        </Link>
                    );
                })}
            </ol>
        </PageContainer>
    );
};

export default LocalOverview;
