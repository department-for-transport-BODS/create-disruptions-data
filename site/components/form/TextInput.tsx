import kebabCase from "lodash/kebabCase";
import { ReactElement, useEffect, useRef, useState } from "react";
import { ErrorInfo, FormBase } from "../../interfaces";
import FormElementWrapper, { FormGroupWrapper } from "./FormElementWrapper";

interface TextInputProps<T> extends FormBase<T> {
    widthClass: string;
    maxLength: number;
    textArea?: boolean;
    rows?: number;
    hint?: string;
    isPassword?: boolean;
    resetError?: boolean;
    isDisabled?: boolean;
}

const TextInput = <T extends object>({
    value,
    display,
    inputName,
    displaySize = "s",
    initialErrors = [],
    widthClass,
    maxLength,
    textArea = false,
    rows,
    hint,
    stateUpdater,
    isPassword,
    resetError = false,
    isDisabled = false,
}: TextInputProps<T>): ReactElement => {
    const [errors, setErrors] = useState<ErrorInfo[]>(initialErrors);
    const inputId = kebabCase(inputName);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (resetError) {
            setErrors([]);
        }
    }, [resetError, setErrors]);

    useEffect(() => {
        if (textArea && textAreaRef.current) {
            textAreaRef.current.value = value || "";
        } else if (!textArea && inputRef.current) {
            inputRef.current.value = value || "";
        }
    }, [value, textArea]);

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
                <FormElementWrapper errors={errors} errorId={inputName} errorClass="govuk-input--error">
                    {textArea ? (
                        <textarea
                            className={`govuk-textarea ${widthClass}`}
                            name={inputName}
                            id={`${inputId}-input`}
                            rows={rows}
                            maxLength={maxLength}
                            defaultValue={value}
                            onChange={(e) => stateUpdater(e.target.value, inputName)}
                            aria-describedby={hint ? `${inputId}-hint` : undefined}
                            ref={textAreaRef}
                        />
                    ) : (
                        <input
                            className={`govuk-input ${widthClass}`}
                            id={`${inputId}-input`}
                            name={inputName}
                            type={isPassword ? "password" : "text"}
                            maxLength={maxLength}
                            defaultValue={value}
                            onChange={(e) => stateUpdater(e.target.value, inputName)}
                            aria-describedby={hint ? `${inputId}-hint` : undefined}
                            ref={inputRef}
                            disabled={isDisabled}
                        />
                    )}
                </FormElementWrapper>
            </div>
        </FormGroupWrapper>
    );
};

export default TextInput;
