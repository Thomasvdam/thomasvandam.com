export type iProxyExerciseGroupKey = 'local';
export type iProxyExerciseKey = 'local_static' | 'local_script' | 'local_html';

export type iProxyExceriseGroupExercises = Record<iProxyExerciseKey, boolean>;
export type iProxyExerciseGroup = {
    completed: number;
    total: number;
    exercises: iProxyExceriseGroupExercises;
};

export type iProxyExercises = Record<iProxyExerciseGroupKey, iProxyExerciseGroup>;
