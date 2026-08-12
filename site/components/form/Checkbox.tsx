import kebabCase from "lodash/kebabCase";
import { ReactElement, useEffect, useRef, useState } from "react";
import { DisplayValuePair, ErrorInfo, FormBase } from "../../interfaces";
import FormElementWrapper, { FormGroupWrapper } from "./FormElementWrapper";

interface CheckboxProps<T> extends FormBase<T> {
    checkboxDetail: DisplayValuePair[];
    hideLegend?: boolean;
    reset?: boolean;
    hint?: string;
    multiple?: boolean;
}

const Checkbox = <T extends object>({
    inputName,
    display,
    displaySize = "s",
    hideLegend = false,
    checkboxDetail,
    initialErrors = [],
    reset,
    stateUpdater,
    hint = "",
    multiple = false,
}: CheckboxProps<T>): ReactElement => {
    const [errors, setErrors] = useState<ErrorInfo[]>(initialErrors);
    const ref = useRef<HTMLInputElement>(null);
    const inputId = kebabCase(inputName);

    useEffect(() => {
        if (reset) {
            setErrors([]);

            if (ref.current) {
                ref.current.checked = false;
            }
        }
    }, [reset]);

    useEffect(() => {
        setErrors(initialErrors);
    }, [initialErrors]);

    return (
        <FormGroupWrapper errorIds={[inputName]} errors={errors}>
            <fieldset className="govuk-fieldset" role="group" id={inputId}>
                <legend className={`govuk-fieldset__legend${hideLegend ? " govuk-visually-hidden" : ""}`}>
                    <span className={`govuk-heading-${displaySize} govuk-!-margin-bottom-0`}>{display}</span>
                </legend>
                {hint ? (
                    <div id={`${inputId}-hint`} className="govuk-hint">
                        {hint}
                    </div>
                ) : null}
                <div className="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes">
                    <FormElementWrapper errors={errors} errorId={inputName} errorClass="govuk-radios--error">
                        <>
                            {checkboxDetail.map((item) => (
                                <div className="govuk-checkboxes__item" key={item.value}>
                                    <input
                                        className="govuk-checkboxes__input"
                                        id={`${inputId}-${item.value}`}
                                        name={inputName}
                                        ref={ref}
                                        type="checkbox"
                                        value={item.value}
                                        onChange={(e) => {
                                            if (multiple) {
                                                stateUpdater(e.currentTarget.value, inputName, e.currentTarget.checked);
                                            } else {
                                                stateUpdater(
                                                    e.currentTarget.checked ? e.currentTarget.value : "",
                                                    inputName,
                                                );
                                            }

                                            setErrors([]);
                                        }}
                                        defaultChecked={item.checked}
                                    />
                                    <label
                                        className="govuk-label govuk-checkboxes__label"
                                        htmlFor={`${inputId}-${item.value}`}
                                    >
                                        {item.display}
                                    </label>
                                </div>
                            ))}
                        </>
                    </FormElementWrapper>
                </div>
            </fieldset>
        </FormGroupWrapper>
    );
};

export default Checkbox;
