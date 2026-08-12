import kebabCase from "lodash/kebabCase";
import { Fragment, ReactElement, RefObject, useEffect, useState } from "react";
import { DisplayValuePair, ErrorInfo, FormBase } from "../../interfaces";
import FormElementWrapper, { FormGroupWrapper } from "./FormElementWrapper";

interface RadiosProps<T> extends FormBase<T> {
    radioDetail: RadioValuePair[];
    paddingTop?: number;
    hint?: string;
}

interface RadioValuePair<T = string> extends DisplayValuePair<T> {
    conditionalElement?: ReactElement;
    ref?: RefObject<HTMLInputElement | null>;
    disabled?: boolean;
}

const Radios = <T extends object>({
    display,
    displaySize = "s",
    inputName,
    radioDetail,
    value,
    initialErrors = [],
    stateUpdater,
    paddingTop,
    hint,
}: RadiosProps<T>): ReactElement => {
    const [errors] = useState<ErrorInfo[]>(initialErrors);
    const inputId = kebabCase(inputName);

    /* Effect added as a workaround for an issue where an updated value causes re-render.
     * Which then updates the checked radio button but any functionality that depends on
     * onClick event is not invoked */
    useEffect(() => {
        radioDetail.map((input) => {
            if (input.value === value && input.ref) {
                input.ref.current?.click();
            }
        });
    }, [radioDetail, value]);

    return (
        <FormGroupWrapper errorIds={[inputName]} errors={errors}>
            <fieldset className="govuk-fieldset" id={inputId}>
                <legend className={`govuk-fieldset__legend${paddingTop ? ` govuk-!-padding-top-${paddingTop}` : ""}`}>
                    <span className={`govuk-heading-${displaySize} govuk-!-margin-bottom-0`}>{display}</span>
                </legend>
                {hint ? (
                    <div id={`${inputId}-hint`} className={"govuk-hint"}>
                        {hint}
                    </div>
                ) : null}
                <FormElementWrapper errors={errors} errorId={inputName} errorClass="govuk-radios--error">
                    <div className="govuk-radios" data-module="govuk-radios">
                        {radioDetail.map((input, index) => (
                            <Fragment key={`radio-${input.value}`}>
                                <div
                                    className={`govuk-radios__item${
                                        index < radioDetail.length - 1 ? " govuk-!-margin-bottom-1" : ""
                                    }`}
                                >
                                    <input
                                        className="govuk-radios__input"
                                        id={`${inputId}-${input.value}`}
                                        name={inputName}
                                        type="radio"
                                        value={input.value}
                                        onChange={(e) => stateUpdater(e.currentTarget.value, inputName)}
                                        defaultChecked={input.value === value || !!input.default}
                                        data-aria-controls={`${inputId}-${input.value}-conditional`}
                                        ref={input.ref}
                                        disabled={input.disabled}
                                    />
                                    <label
                                        className="govuk-label govuk-radios__label"
                                        htmlFor={`${inputId}-${input.value}`}
                                    >
                                        {input.display}
                                    </label>
                                </div>
                                {input.conditionalElement ? (
                                    <div
                                        className="govuk-radios__conditional govuk-radios__conditional--hidden"
                                        id={`${inputId}-${input.value}-conditional`}
                                    >
                                        <div className="govuk-form-group">{input.conditionalElement}</div>
                                    </div>
                                ) : null}
                            </Fragment>
                        ))}
                    </div>
                </FormElementWrapper>
            </fieldset>
        </FormGroupWrapper>
    );
};

export default Radios;
