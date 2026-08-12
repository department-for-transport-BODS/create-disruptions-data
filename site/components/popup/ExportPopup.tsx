import LoadingBox from "@govuk-react/loading-box";
import { kebabCase } from "lodash";
import { Fragment, ReactElement, useState } from "react";
import { ErrorInfo } from "../../interfaces";
import { exportFileSchema } from "../../schemas/disruption.schema";
import FormElementWrapper, { FormGroupWrapper } from "../form/FormElementWrapper";
import Trap from "../layout/Trap";

interface ExportPopUpProps {
    closePopUp: () => void;
    confirmHandler: (fileType: string) => void;
    isOpen: boolean;
    isExporting: boolean;
}

const ExportPopUp = ({ confirmHandler, closePopUp, isOpen, isExporting }: ExportPopUpProps): ReactElement => {
    const [fileType, setFileType] = useState("");
    const [errors, setErrors] = useState<ErrorInfo[]>([]);

    const inputName = "exportType";
    const inputId = kebabCase(inputName);
    const radioDetail = [
        {
            value: "csv",
            display: "CSV",
        },
        {
            value: "excel",
            display: "Excel",
        },
        {
            value: "pdf",
            display: "PDF",
        },
    ];

    const setExportType = (checkedValue: string) => {
        setFileType(checkedValue);
    };

    const onConfirm = () => {
        const parsed = exportFileSchema.shape.exportType.safeParse(fileType);

        if (parsed.success === false) {
            setErrors([
                {
                    id: "exportType",
                    errorMessage: parsed.error.errors[0].message,
                },
            ]);
        } else {
            confirmHandler(fileType);
        }
    };

    return (
        <div
            className={`bg-black/[.2] fixed justify-center items-center top-0 left-0 flex w-full h-screen z-50 ${
                isOpen ? "" : "hidden"
            }`}
        >
            <Trap active={isOpen}>
                <div className="relative bg-white w-full max-w-xl p-10">
                    <FormGroupWrapper errorIds={[inputName]} errors={errors}>
                        <fieldset className="govuk-fieldset" id={inputId}>
                            <legend className="govuk-fieldset__legend govuk-!-padding-top">
                                <span className="govuk-heading-s govuk-!-margin-bottom-0">
                                    What format would you like to export this as?
                                </span>
                            </legend>
                            <LoadingBox loading={isExporting}>
                                <FormElementWrapper
                                    errors={errors}
                                    errorId={inputName}
                                    errorClass="govuk-radios--error"
                                >
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
                                                        onChange={(e) => setExportType(e.currentTarget.value)}
                                                        data-aria-controls={`${inputId}-${input.value}-conditional`}
                                                    />
                                                    <label
                                                        className="govuk-label govuk-radios__label"
                                                        htmlFor={`${inputId}-${input.value}`}
                                                    >
                                                        {input.display}
                                                    </label>
                                                </div>
                                            </Fragment>
                                        ))}
                                    </div>
                                </FormElementWrapper>
                            </LoadingBox>
                        </fieldset>
                    </FormGroupWrapper>
                    <button className="govuk-button" data-module="govuk-button" onClick={onConfirm}>
                        Export
                    </button>
                    <button
                        className="govuk-button ml-5 govuk-button--secondary"
                        data-module="govuk-button"
                        onClick={closePopUp}
                    >
                        Cancel
                    </button>
                </div>
            </Trap>
        </div>
    );
};

export default ExportPopUp;
