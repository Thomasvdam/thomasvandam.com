import * as React from 'react';
import {
    iProxyExerciseGroupKey,
    iProxyExerciseKey,
    iProxyExercises,
} from '~proxy-exercises/models';

const ProxyExerciseProgressContext = React.createContext<{
    exerciseState: iProxyExercises;
    markCompleted: (group: iProxyExerciseGroupKey, exercise: iProxyExerciseKey) => void;
} | null>(null);

export default ProxyExerciseProgressContext;
