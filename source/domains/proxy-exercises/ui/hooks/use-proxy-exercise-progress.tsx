import { useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { PROXY_EXERCISE_PROGRESS_KEY } from '~proxy-exercises/constants';
import { iProxyExerciseGroupKey, iProxyExerciseKey } from '~proxy-exercises/models';
import {
    actionTypes,
    initialState,
    reducer,
} from '~proxy-exercises/ui/reducers/proxy-exercise-progress';
import ProxyExerciseProgressContext from '~proxy-exercises/ui/context/proxy-exercise-progress';

export const useProxyExerciseProgress = () => {
    const context = useContext(ProxyExerciseProgressContext);
    if (context === null) throw new Error('Missing ProxyExerciseProgressProvider at root');

    return context;
};

export const ProxyExerciseProgressProvider = ({ children }) => {
    const [exerciseState, dispatch] = useReducer(reducer, initialState);

    useEffect(() => {
        const rawProgress = localStorage.getItem(PROXY_EXERCISE_PROGRESS_KEY);
        if (!rawProgress) return;

        try {
            const storedProgress = JSON.parse(rawProgress);
            dispatch({
                type: actionTypes.SET_STATE,
                payload: storedProgress,
            });
        } catch (error) {
            console.error('Parsing stored progress failed', error);
        }
    }, []);

    useEffect(() => {
        if (exerciseState === initialState) return;

        try {
            localStorage.setItem(PROXY_EXERCISE_PROGRESS_KEY, JSON.stringify(exerciseState));
        } catch (error) {
            console.error('Storing progress failed', error);
        }
    }, [exerciseState]);

    const markCompleted = useCallback(
        (group: iProxyExerciseGroupKey, exercise: iProxyExerciseKey) => {
            dispatch({
                type: actionTypes.COMPLETE_EXERCISE,
                payload: {
                    group,
                    exercise,
                },
            });
        },
        [],
    );

    const api = useMemo(() => {
        return {
            exerciseState,
            markCompleted,
        };
    }, [exerciseState, markCompleted]);

    return (
        <ProxyExerciseProgressContext.Provider value={api}>
            {children}
        </ProxyExerciseProgressContext.Provider>
    );
};
