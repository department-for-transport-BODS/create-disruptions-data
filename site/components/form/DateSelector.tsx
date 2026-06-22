import { getFormattedDate } from "@create-disruptions-data/shared-ts/utils/dates";
import { FilledInputProps } from "@mui/material/FilledInput";
import { InputBaseComponentProps } from "@mui/material/InputBase";
import { OutlinedInputProps } from "@mui/material/OutlinedInput";
import { DatePicker, PickersDay, PickersDayProps } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { Dayjs } from "dayjs";
import kebabCase from "lodash/kebabCase";
import React, { ReactElement, useEffect, useState } from "react";
import { ErrorInfo, FormBase } from "../../interfaces";
import FormElementWrapper, { FormGroupWrapper } from "./FormElementWrapper";

interface DateSelectorProps<T> extends FormBase<T> {
    disabled?: boolean;
    hint?: {
        hidden: boolean;
        text: string;
    };
    disablePast: boolean;
    reset?: boolean;
    suffixId?: string;
    resetError?: boolean;
    minWidth?: string;
    inputDivWidth?: string;
    errorAlign?: boolean;
}

// Stable component for customised day cells in the calendar popup (v7 slots.day)
const CustomPickersDay = (props: PickersDayProps<Dayjs>) => (
    <PickersDay
        {...props}
        classes={{
            selected: "!bg-govBlue",
            dayWithMargin:
                "focus:!border focus:!border-solid hover:!border hover:!border-solid hover:!border-govBlue focus:!border-govYellow",
        }}
    />
);

interface DatePickerTextFieldProps {
    inputRef?: React.Ref<HTMLInputElement>;
    inputProps?: InputBaseComponentProps;
    InputProps?: Partial<FilledInputProps> | Partial<OutlinedInputProps>;
    inputId: string;
    inputName: string;
    errors: ErrorInfo[];
    disabled: boolean;
    minWidth?: string;
    inputDivWidth?: string;
}

// Stable component for the govuk-styled date input (v7 slots.textField, replaces v5 renderInput)
const DatePickerTextField = ({
    inputRef,
    inputProps,
    InputProps,
    inputId,
    inputName,
    errors,
    disabled,
    minWidth,
    inputDivWidth,
}: DatePickerTextFieldProps) => (
    <div className="govuk-date-input flex flex-row [&_.MuiSvgIcon-root]:fill-govBlue">
        <div className={`govuk-date-input__item govuk-!-margin-right-0 ${inputDivWidth ? inputDivWidth : ""}`}>
            <FormElementWrapper errors={errors} errorId={inputName} errorClass="govuk-input--error">
                <input
                    className={`govuk-input govuk-date-input__input govuk-input--width-6 ${minWidth ? minWidth : ""}`}
                    name={inputName}
                    id={`${inputId}-input`}
                    type="text"
                    ref={inputRef}
                    {...inputProps}
                    disabled={disabled}
                    placeholder={disabled ? "N/A" : "DD/MM/YYYY"}
                />
            </FormElementWrapper>
        </div>
        <div className="flex items-end pb-5">{InputProps?.endAdornment}</div>
    </div>
);

const DateSelector = <T extends object>({
    value,
    display,
    displaySize = "s",
    inputName,
    initialErrors = [],
    disabled = false,
    hint,
    disablePast,
    stateUpdater,
    reset = false,
    suffixId,
    resetError = false,
    minWidth,
    inputDivWidth,
    errorAlign = false,
}: DateSelectorProps<T>): ReactElement<any> => {
    const [dateValue, setDateValue] = useState<Dayjs | null>(
        !!disabled || !value ? null : getFormattedDate(value),
    );
    const [errors, setErrors] = useState<ErrorInfo[]>(initialErrors);
    const inputId = suffixId ? `${kebabCase(inputName + suffixId)}` : kebabCase(inputName);

    useEffect(() => {
        if (disabled || reset) {
            setErrors([]);
            setDateValue(null);
        }
    }, [disabled, reset]);

    useEffect(() => {
        if (resetError) {
            setErrors([]);
        }
    }, [resetError]);

    useEffect(() => {
        setDateValue(value ? getFormattedDate(value) : null);
    }, [value]);

    useEffect(() => {
        setErrors(initialErrors);
    }, [JSON.stringify(initialErrors)]);

    return (
        <FormGroupWrapper errorIds={[inputName]} errors={errors} errorAlign={errorAlign}>
            <div
                className={`govuk-form-group govuk-!-margin-bottom-0 ${errorAlign ? "h-full flex flex-col" : ""}`}
                id={inputId}
            >
                <div>
                    <label className={`govuk-label govuk-label--${displaySize}`} htmlFor={`${inputId}-input`}>
                        {display}
                    </label>
                </div>
                {hint ? (
                    <div className={`govuk-hint${hint.hidden ? " govuk-visually-hidden" : ""}`}>{hint.text}</div>
                ) : null}
                <div className="flex flex-col mt-auto">
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker
                            slots={{
                                day: CustomPickersDay,
                                textField: DatePickerTextField as React.ElementType,
                            }}
                            slotProps={{
                                textField: {
                                    inputId,
                                    inputName: inputName as string,
                                    errors,
                                    disabled,
                                    minWidth,
                                    inputDivWidth,
                                } as any,
                            }}
                            value={dateValue}
                            onChange={(newValue: Dayjs | null) => {
                                setDateValue(newValue);
                                if (newValue) {
                                    stateUpdater(newValue.format("DD/MM/YYYY"), inputName);
                                } else {
                                    stateUpdater("", inputName);
                                }
                            }}
                            onAccept={() => setErrors([])}
                            format="DD/MM/YYYY"
                            disablePast={disablePast}
                            disabled={disabled}
                            aria-describedby={hint ? `${inputName}-hint` : undefined}
                        />
                    </LocalizationProvider>
                </div>
            </div>
        </FormGroupWrapper>
    );
};

export default DateSelector;
