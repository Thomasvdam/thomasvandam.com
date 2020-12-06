import { d6 } from '~source/core/models';
import { Die6, PageContainer } from '~source/ui/components/atoms';
import $ from './polar-view.module.scss';

interface iProps {
    diceRolls: {
        roll: d6;
        colour: string;
    }[];
}

const PolarView: React.FC<iProps> = ({ diceRolls }) => {
    return (
        <div className={$.polar}>
            <PageContainer>
                <h1>Ice Holes and Polar Bears</h1>
                <section className={$.dice_container}>
                    {diceRolls.map((die, index) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <Die6 key={index} angled colour={die.colour} number={die.roll} />
                    ))}
                </section>
            </PageContainer>
        </div>
    );
};

export default PolarView;
