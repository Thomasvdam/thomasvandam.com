import { iProxyExerciseGroupKey } from '~source/domains/proxy-exercises/models';
import { CheckMark } from '~proxy-exercises/ui/components';
import { useProxyExerciseProgress } from '~proxy-exercises/ui/hooks/use-proxy-exercise-progress';

import $ from './group-summary.module.scss';

interface iProps {
    groupKey: iProxyExerciseGroupKey;
    title: string;
}

export const GroupSummary: React.FC<iProps> = ({ title, groupKey }) => {
    const { exerciseState } = useProxyExerciseProgress();
    const group = exerciseState[groupKey];

    return (
        <div className={$.container}>
            <h3 className={$.title}>{title}</h3>
            <div className={$.progress_container}>
                <div className={$.progress}>
                    {group.completed} / {group.total}
                </div>
                <div className={$.indicator}>
                    <CheckMark checked={group.completed === group.total} />
                </div>
            </div>
        </div>
    );
};
