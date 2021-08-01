import $ from './code-block.module.scss';

interface iProps {
    contents: string | null;
}

export const CodeBlock: React.FC<iProps> = ({ contents }) => {
    if (!contents) return null;

    return (
        <pre className={$.code_block}>
            {contents.split('\n').map((line, index) => {
                // eslint-disable-next-line react/no-array-index-key
                return <code key={index}>{line}</code>;
            })}
        </pre>
    );
};
