import { Link } from 'react-router-dom';
import { paths } from '~source/domains/proxy-exercises/paths';
import { PageContainer } from '~source/ui/components';
import { GroupSummary } from '~proxy-exercises/ui/components';

import $ from './intro.module.scss';

export const Intro: React.FC = () => {
    return (
        <PageContainer>
            <h1 className={$.title}>Overview</h1>

            <p className={$.text}>A description of what this is and why it is.</p>

            <ol className={$.groups_container}>
                <Link className={$.link} to={paths.local}>
                    <li className={$.group_item}>
                        <GroupSummary title="Map local" groupKey="local" />
                    </li>
                </Link>
            </ol>
        </PageContainer>
    );
};

export default Intro;
