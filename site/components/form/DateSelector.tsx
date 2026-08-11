import { getFormattedDate } from "@create-disruptions-data/shared-ts/utils/dates";
import { FilledInputProps } from "@mui/material/FilledInput";
import { InputBaseComponentProps } from "@mui/material/InputBase";
import { OutlinedInputProps } from "@mui/material/OutlinedInput";
import { DatePicker, PickersDay, PickersDayProps } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import kebabCase from "lodash/kebabCase";
import React, { ReactElement, useEffect, useState } from "react";
import { ErrorInfo, FormBase } from "../../interfaces";
import { convertDateTimeToFormat } from "../../utils/dates";
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

const inputBox = <T extends object>(
    inputRef: React.Ref<HTMLInputElement> | undefined,
    inputProps: InputBaseComponentProps | undefined,
    InputProps: Partial<FilledInputProps> | Partial<OutlinedInputProps> | undefined,
    inputId: string,
    inputName: Extract<keyof T, string>,
    errors: ErrorInfo[],
    disabled: boolean,
    minWidth?: string,
    inputDivWidth?: string,
) => (
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

const renderWeekPickerDay = (
    _date: Date,
    _selectedDates: Array<Date | null>,
    pickersDayProps: PickersDayProps<Date>,
) => (
    <PickersDay
        {...pickersDayProps}
        classes={{
            selected: "!bg-govBlue",
            dayWithMargin:
                "focus:!border focus:!border-solid hover:!border hover:!border-solid hover:!border-govBlue focus:!border-govYellow",
        }}
    />
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
    const [dateValue, setDateValue] = useState<Date | null>(
        !!disabled || !value ? null : getFormattedDate(value).toDate(),
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
        setDateValue(value ? getFormattedDate(value).toDate() : null);
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
                            renderDay={renderWeekPickerDay}
                            value={dateValue}
                            onChange={(newValue) => {
                                setDateValue(newValue);
                                if (newValue) {
                                    stateUpdater(convertDateTimeToFormat(newValue, "DD/MM/YYYY"), inputName);
                                } else {
                                    stateUpdater("", inputName);
                                }
                            }}
                            onAccept={() => setErrors([])}
                            renderInput={({ inputRef, inputProps, InputProps }) => {
                                return inputBox(
                                    inputRef,
                                    inputProps,
                                    InputProps,
                                    inputId,
                                    inputName,
                                    errors,
                                    disabled,
                                    minWidth,
                                    inputDivWidth,
                                );
                            }}
                            disablePast={disablePast}
                            inputFormat="DD/MM/YYYY"
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
