import { useParams } from 'react-router-dom';
import { PageContainer } from '~source/ui/components';
import { iProxyExerciseKeyLocal } from '~proxy-exercises/models';
import { paths } from '~proxy-exercises/paths';
import { ExerciseLoader } from '~proxy-exercises/ui/components/exercise-loader';
import MapStatic from './exercises/map-static';

import $ from './local-exercise.module.scss';

const map: Record<iProxyExerciseKeyLocal, React.FC> = {
    local_html: MapStatic,
    local_script: () => <p>Script</p>,
    local_static: MapStatic,
};

export const LocalExercise: React.FC = () => {
    const { exerciseKey } = useParams<{ exerciseKey: iProxyExerciseKeyLocal }>();

    return (
        <PageContainer>
            <ExerciseLoader map={map} exerciseKey={exerciseKey} redirectTo={paths.local} />
        </PageContainer>
    );
};

export default LocalExercise;
