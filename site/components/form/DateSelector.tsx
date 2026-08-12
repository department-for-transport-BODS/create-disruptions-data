import { getFormattedDate } from "@create-disruptions-data/shared-ts/utils/dates";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { CalendarIcon } from "@mui/x-date-pickers/icons";
import type { Dayjs } from "dayjs";
import kebabCase from "lodash/kebabCase";
import { ReactElement, useEffect, useState } from "react";
import { ErrorInfo, FormBase } from "../../interfaces";
import { convertDateTimeToFormat } from "../../utils/dates";
import FormElementWrapper, { FormGroupWrapper } from "./FormElementWrapper";

const gdsTransportTheme = createTheme({
    typography: {
        fontFamily: '"GDS Transport", arial, sans-serif',
        fontSize: 16,
    },
});

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
    inputDivWidth,
    errorAlign = false,
}: DateSelectorProps<T>): ReactElement => {
    const [dateValue, setDateValue] = useState<Dayjs | null>(disabled || !value ? null : getFormattedDate(value));
    const [errors, setErrors] = useState<ErrorInfo[]>(initialErrors);
    const [pickerOpen, setPickerOpen] = useState(false);
    const inputId = suffixId ? kebabCase(inputName + suffixId) : kebabCase(inputName);

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
        if (value) {
            const formatted = getFormattedDate(value);
            if (formatted.isValid()) {
                setDateValue(formatted);
            }
        }
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
                    <div
                        id={`${inputName}-hint`}
                        className={`govuk-hint${hint.hidden ? " govuk-visually-hidden" : ""}`}
                    >
                        {hint.text}
                    </div>
                ) : null}
                <div className="flex flex-col mt-auto">
                    <FormElementWrapper errors={errors} errorId={inputName} errorClass="govuk-input--error">
                        <div className="govuk-date-input flex flex-row items-start gap-2 [&_.MuiSvgIcon-root]:fill-govBlue">
                            <div
                                className={`govuk-date-input__item govuk-!-margin-right-0 ${inputDivWidth ? inputDivWidth : ""}`}
                            >
                                <ThemeProvider theme={gdsTransportTheme}>
                                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                                        <DatePicker
                                            value={dateValue}
                                            open={pickerOpen}
                                            onOpen={() => setPickerOpen(true)}
                                            onClose={() => setPickerOpen(false)}
                                            onChange={(newValue) => {
                                                setDateValue(newValue);
                                                if (newValue) {
                                                    stateUpdater(
                                                        convertDateTimeToFormat(newValue.toDate(), "DD/MM/YYYY"),
                                                        inputName,
                                                    );
                                                } else {
                                                    stateUpdater("", inputName);
                                                }
                                            }}
                                            onAccept={() => setErrors([])}
                                            disablePast={disablePast}
                                            format="DD/MM/YYYY"
                                            disabled={disabled}
                                            slots={{
                                                openPickerButton: () => null,
                                            }}
                                            slotProps={{
                                                textField: {
                                                    id: `${inputId}-input`,
                                                    error: errors.length > 0,
                                                    disabled,
                                                    slotProps: {
                                                        input: {
                                                            id: `${inputId}-input`,
                                                            className:
                                                                "govuk-input govuk-date-input__input govuk-input--width-6",
                                                        },
                                                    },
                                                    sx: {
                                                        fontFamily: '"GDS Transport", arial, sans-serif',
                                                        "& .MuiPickersOutlinedInput-root": {
                                                            borderRadius: 0,
                                                            backgroundColor: "transparent",
                                                            height: "2.5rem",
                                                            boxSizing: "border-box",
                                                            fontFamily: "inherit",
                                                        },
                                                        "& .MuiPickersOutlinedInput-root.Mui-focused": {
                                                            outline: "3px solid #ffdd00",
                                                            outlineOffset: 0,
                                                            boxShadow: "inset 0 0 0 2px",
                                                            zIndex: 1,
                                                        },
                                                        "& .MuiPickersOutlinedInput-root.Mui-focused .MuiPickersOutlinedInput-notchedOutline":
                                                            {
                                                                border: "none",
                                                            },
                                                    },
                                                },
                                            }}
                                        />
                                    </LocalizationProvider>
                                </ThemeProvider>
                            </div>
                            <button
                                type="button"
                                aria-label={`Choose ${display} date`}
                                disabled={disabled}
                                onClick={() => setPickerOpen(true)}
                                className="flex h-10 w-10 shrink-0 items-center justify-center bg-white outline-none focus:outline-none hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed [&_.MuiSvgIcon-root]:fill-govBlue"
                            >
                                <CalendarIcon />
                            </button>
                        </div>
                    </FormElementWrapper>
                </div>
            </div>
        </FormGroupWrapper>
    );
};

export default DateSelector;
