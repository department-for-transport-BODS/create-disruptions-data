import { Dispatch, Fragment, ReactElement, SetStateAction, type JSX } from "react";
import Select, {
    ControlProps,
    GroupBase,
    OptionProps,
    SingleValue,
    InputActionMeta,
    ActionMeta,
    CSSObjectWithLabel,
} from "react-select";
import type { FilterOptionOption } from "react-select/dist/declarations/src/filters";
import { ErrorInfo } from "../../interfaces";
import FormElementWrapper, { FormGroupWrapper } from "./FormElementWrapper";
import Table from "./Table";

interface SearchSelectProps<T> {
    placeholder: string;
    inputName: string;
    initialErrors?: ErrorInfo[];
    getOptionLabel?: (value: T) => string;
    handleChange: (value: SingleValue<T>, actionMeta: ActionMeta<T>) => void;
    tableData: T[] | undefined | null;
    getRows: () =>
        | {
              header?: string;
              cells: (string | JSX.Element)[];
          }[]
        | undefined;
    selected: SingleValue<T>;
    getOptionValue?: (value: T) => string;
    display: string;
    displaySize?: string;
    inputId: string;
    hint?: string;
    isClearable?: boolean;
    options: T[] | undefined;
    inputValue: string;
    setSearchInput: Dispatch<SetStateAction<string>>;
    filterOptions?: (option: FilterOptionOption<object>, rawInput: string) => boolean;
    width?: string;
    onFocus?: () => void;
    onBlur?: () => void;
    closeMenuOnSelect?: boolean;
    className?: string;
    disabled?: boolean;
}
const SearchSelect = <T extends object>({
    selected,
    inputName,
    initialErrors = [],
    placeholder = "Select...",
    getOptionLabel,
    handleChange,
    tableData,
    getRows,
    getOptionValue,
    hint,
    inputId,
    display,
    displaySize = "s",
    isClearable = false,
    options,
    inputValue = "",
    setSearchInput = (value) => value,
    filterOptions,
    width,
    onFocus,
    onBlur,
    closeMenuOnSelect = true,
    className = "",
    disabled = false,
}: SearchSelectProps<T>): ReactElement<any> => {
    const handleInputChange = (value: string, { action }: InputActionMeta) => {
        if (action === "menu-close" || action === "input-blur" || action === "set-value") {
            return;
        }
        setSearchInput(value);
    };

    const controlStyles = (state: ControlProps<T, false, GroupBase<T>>): CSSObjectWithLabel => ({
        fontFamily: "GDS Transport, arial, sans-serif",
        border: "black solid 3px",
        outline: state.isFocused ? "#ffdd00 solid 3px" : "none",
        color: state.isFocused ? "white" : "black",
        marginBottom: "20px",
        "&:hover": { borderColor: "black" },
        width: width ? width : "75%",
    });

    const optionStyles = (state: OptionProps<T, false, GroupBase<T>>): CSSObjectWithLabel => ({
        color: state.isFocused ? "white" : "black",
        backgroundColor: state.isFocused ? "#3399ff" : "white",
    });
    return (
        <FormGroupWrapper errorIds={[inputId]} errors={initialErrors}>
            <div className="govuk-form-group">
                <label
                    id={`${inputId}-label`}
                    className={`govuk-label govuk-label--${displaySize}`}
                    htmlFor={`${inputId}-input`}
                >
                    {display}
                </label>
                {hint ? (
                    <div id={`${inputId}-hint`} className="govuk-hint">
                        {hint}
                    </div>
                ) : null}
                <FormElementWrapper errors={initialErrors} errorId={inputId} errorClass="govuk-input--error">
                    <Select
                        aria-labelledby={`${inputId}-label`}
                        isSearchable
                        styles={{
                            control: (baseStyles, state) => ({
                                ...baseStyles,
                                ...controlStyles(state),
                            }),
                            option: (provided, state) => ({
                                ...provided,
                                ...optionStyles(state),
                            }),
                            placeholder: (baseStyles) => ({
                                ...baseStyles,
                                color: "black",
                            }),
                        }}
                        value={selected}
                        closeMenuOnSelect={closeMenuOnSelect}
                        placeholder={placeholder}
                        getOptionLabel={getOptionLabel}
                        getOptionValue={getOptionValue}
                        options={options}
                        onInputChange={handleInputChange}
                        inputValue={inputValue}
                        onChange={handleChange}
                        id={inputId}
                        instanceId={`dropdown-${inputName}`}
                        inputId={`${inputId}-input`}
                        menuPlacement="auto"
                        menuPosition="fixed"
                        isClearable={isClearable}
                        filterOption={filterOptions}
                        onFocus={onFocus}
                        onBlur={onBlur}
                        className={className || "text-lg text-black"}
                        isDisabled={disabled}
                    />
                </FormElementWrapper>

                {tableData && <Table rows={getRows() ?? []} />}

                {(tableData || []).map((element, index) => (
                    <Fragment key={`${inputName}-${index}`}>
                        <input type="hidden" name={`${inputName}${index + 1}`} value={JSON.stringify(element)} />
                    </Fragment>
                ))}
            </div>
        </FormGroupWrapper>
    );
};

export default SearchSelect;
