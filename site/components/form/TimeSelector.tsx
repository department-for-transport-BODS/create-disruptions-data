import kebabCase from "lodash/kebabCase";
import { ReactElement, SyntheticEvent, useEffect, useRef, useState } from "react";
import { ErrorInfo, FormBase } from "../../interfaces";
import FormElementWrapper, { FormGroupWrapper } from "./FormElementWrapper";

interface TimeSelectorProps<T> extends FormBase<T> {
    disabled?: boolean;
    hint?: string;
    reset?: boolean;
    placeholderValue?: string;
    resetError?: boolean;
    showNowButton?: (e: SyntheticEvent) => void;
    inputDivWidth?: string;
    errorAlign?: boolean;
}

const TimeSelector = <T extends object>({
    value,
    display,
    displaySize = "s",
    inputName,
    initialErrors = [],
    disabled = false,
    hint,
    stateUpdater,
    reset = false,
    placeholderValue = "hhmm",
    resetError = false,
    showNowButton,
    inputDivWidth,
    errorAlign = false,
}: TimeSelectorProps<T>): ReactElement => {
    const [errors, setErrors] = useState<ErrorInfo[]>(initialErrors);
    const ref = useRef<HTMLInputElement>(null);
    const inputId = kebabCase(inputName);

    useEffect(() => {
        if (disabled || reset) {
            setErrors([]);

            if (ref.current) {
                ref.current.value = "";
            }
        }
    }, [disabled, reset]);

    useEffect(() => {
        if (resetError) {
            setErrors([]);
        }
    }, [resetError]);

    useEffect(() => {
        if (ref.current) {
            ref.current.value = value || "";
        }
    }, [value]);

    useEffect(() => {
        setErrors(initialErrors);
    }, [initialErrors]);

    return (
        <FormGroupWrapper errorIds={[inputName]} errors={errors} errorAlign={errorAlign}>
            <div className={`govuk-form-group ${errorAlign ? "h-full flex flex-col" : ""}`} id={inputId}>
                <div>
                    <label className={`govuk-label govuk-label--${displaySize}`} htmlFor={`${inputId}-input`}>
                        {display}
                    </label>
                </div>
                {hint ? (
                    <div id={`${inputId}-hint`} className={`govuk-hint${errorAlign ? " flex-grow" : ""}`}>
                        {hint}
                    </div>
                ) : null}
                <div className={showNowButton ? "flex flex-row content-end gap-4 mt-auto" : "mt-auto"}>
                    <div className={`${inputDivWidth ? inputDivWidth : ""}`}>
                        <FormElementWrapper errors={errors} errorId={inputName} errorClass="govuk-input--error">
                            <input
                                ref={ref}
                                className="govuk-input govuk-date-input__input govuk-input--width-4"
                                name={inputName}
                                id={`${inputId}-input`}
                                type="text"
                                defaultValue={value}
                                disabled={disabled}
                                placeholder={disabled ? "N/A" : placeholderValue}
                                aria-describedby={hint ? `${inputId}-hint` : ""}
                                onChange={(e) => {
                                    stateUpdater(e.target.value, inputName);
                                }}
                            />
                        </FormElementWrapper>
                    </div>
                    {showNowButton ? (
                        <div className="flex items-end">
                            <button className="mt-3 govuk-link h-6" data-module="govuk-button" onClick={showNowButton}>
                                <p className="text-govBlue govuk-body-m">Now</p>
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
        </FormGroupWrapper>
    );
};

export default TimeSelector;
