import { d6 } from '~source/core/models';
import { Die6 } from '~source/ui/components/atoms';
import $ from './polar-view.module.scss';

interface iProps {
    diceRolls: d6[];
}

const PolarView: React.FC<iProps> = ({ diceRolls }) => {
    return (
        <div className={$.polar}>
            <h1>Ice Holes and Polar Bears</h1>
            <section>
                {diceRolls.map((number) => (
                    <Die6 number={number} />
                ))}
            </section>
        </div>
    );
};

export default PolarView;
