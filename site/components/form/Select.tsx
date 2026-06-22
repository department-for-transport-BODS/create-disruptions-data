import kebabCase from "lodash/kebabCase";
import { ReactElement, useState, type JSX } from "react";
import { DisplayValuePair, ErrorInfo, FormBase } from "../../interfaces";
import FormElementWrapper, { FormGroupWrapper } from "./FormElementWrapper";

interface SelectProps<T> extends FormBase<T> {
    defaultDisplay: string;
    selectValues: DisplayValuePair[];
    width?: string;
    useDefaultValue?: boolean;
    hint?: string;
}

const Select = <T extends object>({
    value,
    inputName,
    display,
    displaySize = "s",
    initialErrors = [],
    defaultDisplay,
    selectValues,
    stateUpdater,
    width = "3/4",
    useDefaultValue = true,
    hint,
}: SelectProps<T>): ReactElement<any> => {
    const [errors] = useState<ErrorInfo[]>(initialErrors);
    const inputId = kebabCase(inputName);

    const getSelectOptions = (): JSX.Element[] => {
        const options: JSX.Element[] = [
            <option value="" disabled key="">
                {defaultDisplay}
            </option>,
        ];

        selectValues.forEach((input) => {
            options.push(
                <option value={input.value} key={`option-${input.value}`}>
                    {input.display}
                </option>,
            );
        });

        return options;
    };

    return (
        <FormGroupWrapper errorIds={[inputName]} errors={errors}>
            <div className="govuk-form-group" id={inputId}>
                <label className={`govuk-label govuk-label--${displaySize}`} htmlFor={`${inputId}-input`}>
                    {display}
                </label>
                {hint ? (
                    <div id={`${inputId}-hint`} className="govuk-hint">
                        {hint}
                    </div>
                ) : null}
                <FormElementWrapper errors={errors} errorId={inputName} errorClass="govuk-select--error">
                    <select
                        className={`govuk-select w-${width}`}
                        name={inputName}
                        id={`${inputId}-input`}
                        defaultValue={useDefaultValue ? value ?? "" : undefined}
                        value={!useDefaultValue ? value ?? "" : undefined}
                        onChange={(e) => stateUpdater(e.target.value, inputName)}
                        aria-describedby={hint ? `${inputName}-hint` : undefined}
                    >
                        {getSelectOptions()}
                    </select>
                </FormElementWrapper>
            </div>
        </FormGroupWrapper>
    );
};

export default Select;
