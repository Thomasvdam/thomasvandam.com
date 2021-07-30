import {
    iProxyExceriseGroupExercises,
    iProxyExerciseGroupKey,
    iProxyExerciseKey,
    iProxyExercises,
} from '~proxy-exercises/models';

export enum actionTypes {
    COMPLETE_EXERCISE,
    SET_STATE,
}

interface iCompleteAction {
    type: actionTypes.COMPLETE_EXERCISE;
    payload: { group: iProxyExerciseGroupKey; exercise: iProxyExerciseKey };
}

interface iSetStateAction {
    type: actionTypes.SET_STATE;
    payload: iProxyExercises;
}

type iAction = iCompleteAction | iSetStateAction;

export const initialState: iProxyExercises = {
    local: {
        completed: 0,
        total: 3,
        exercises: {
            local_static: false,
            local_script: false,
            local_html: false,
        },
    },
};

export const reducer = (state: iProxyExercises, action: iAction) => {
    if (action.type === actionTypes.COMPLETE_EXERCISE) {
        const group = state[action.payload.group];
        group.exercises[action.payload.exercise] = true;

        group.completed = Object.values(group.exercises).reduce((acc, completed) => {
            if (completed) return acc + 1;
            return acc;
        }, 0);

        return { ...state, [action.payload.group]: group };
    }

    if (action.type === actionTypes.SET_STATE) {
        try {
            const groupKeys = Object.keys(initialState);
            const newState: any = {};
            groupKeys.forEach((groupKey: iProxyExerciseGroupKey) => {
                const newGroup = {
                    completed: 0,
                    total: initialState[groupKey].total,
                    exercises: {} as iProxyExceriseGroupExercises,
                };

                const exerciseKeys = Object.keys(initialState[groupKey].exercises);
                exerciseKeys.forEach((exerciseKey) => {
                    newGroup.exercises[exerciseKey] = initialState[groupKey].exercises[exerciseKey];
                });

                newGroup.completed = Object.values(newGroup.exercises).reduce((acc, completed) => {
                    if (completed) return acc + 1;
                    return acc;
                }, 1);

                newState[groupKey] = newGroup;
            });

            return newState;
        } catch (error) {
            return state;
        }
    }

    return state;
};
