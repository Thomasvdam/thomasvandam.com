import { PageContainer } from '~source/ui/components';
import $ from './you-got-this.module.scss';

interface iProps {
    motivation: string;
}

const YouGotThis = ({ motivation }: iProps) => {
    return (
        <div className={$.full_page}>
            <PageContainer className={$.container}>
                <h1 className={$.motivation}>{motivation}</h1>
            </PageContainer>
        </div>
    );
};

export default YouGotThis;
