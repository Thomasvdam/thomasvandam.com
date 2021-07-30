import { paths } from '~proxy-exercises/paths';
import { Intro, LocalOverview, LocalExercise, NotFound } from '~proxy-exercises/ui/views';

export const routes = [
    {
        path: paths.home,
        component: Intro,
    },
    {
        path: paths.local,
        component: LocalOverview,
    },
    {
        path: paths.localExercise,
        component: LocalExercise,
    },
    {
        path: '*',
        component: NotFound,
    },
];
