import { Redirect } from 'react-router-dom';
import { iProxyExerciseKey } from '~source/domains/proxy-exercises/models';

interface iProps<T extends iProxyExerciseKey> {
    exerciseKey: iProxyExerciseKey | null;
    map: Record<T, React.FC>;
    redirectTo: string;
}

export const ExerciseLoader = <T extends iProxyExerciseKey>({
    exerciseKey,
    map,
    redirectTo,
}: iProps<T>) => {
    const Component = map[exerciseKey];
    if (!Component) return <Redirect to={redirectTo} />;

    return <Component />;
};
