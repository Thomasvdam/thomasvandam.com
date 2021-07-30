import { BrowserRouter, Switch, Route } from 'react-router-dom';
import { routes } from '~proxy-exercises/routes';
import { ProxyExerciseProgressProvider } from '~proxy-exercises/ui/hooks/use-proxy-exercise-progress';

const App = () => {
    return (
        <ProxyExerciseProgressProvider>
            <BrowserRouter basename="/proxy-exercises">
                <Switch>
                    {routes.map(({ path, component }) => (
                        <Route key={path} path={path} component={component} exact />
                    ))}
                </Switch>
            </BrowserRouter>
        </ProxyExerciseProgressProvider>
    );
};

export default App;
