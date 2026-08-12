import { ReactElement, ReactNode } from "react";

interface WarningProps {
    text: string;
    symbol?: string;
    title?: string;
    children?: ReactNode;
}

const Warning = ({ text, symbol = "!", title = "Warning", children }: WarningProps): ReactElement => (
    <div className="govuk-warning-text">
        <span className="govuk-warning-text__icon" aria-hidden="true">
            {symbol}
        </span>
        <strong className="govuk-warning-text__text">
            <span className="govuk-visually-hidden">{title}</span>
            {text}
            {children}
        </strong>
    </div>
);

export default Warning;
