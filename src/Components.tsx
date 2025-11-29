
interface ButtonProps {
    id?: string
    count?: number
    text?: string
    click?: () => void
    className?: string
}
function Button({id, text, click, count, className}: ButtonProps) {
    return (
        <button id={id} onClick={click} className={className}>
            <p>{text || 'Click Me'}</p>
            <p>{count}</p>
        </button>
    );
}

const Components = {
    Button: Button
};

export default Components;