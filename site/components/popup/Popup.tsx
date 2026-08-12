import React, { ReactElement } from "react";
import CsrfForm from "../form/CsrfForm";
import Trap from "../layout/Trap";

interface PopUpProps {
    action: string;
    cancelActionHandler: React.MouseEventHandler<HTMLButtonElement>;
    hintText?: string;
    csrfToken: string;
    hiddenInputs: { name: string; value: string | undefined }[];
    continueText: string;
    cancelText: string;
    questionText: string;
    isWarning?: boolean;
    isOpen: boolean;
}

const Popup = ({
    action,
    cancelActionHandler,
    hintText,
    csrfToken,
    hiddenInputs,
    continueText,
    cancelText,
    questionText,
    isWarning,
    isOpen,
}: PopUpProps): ReactElement | null => {
    return (
        <div className="modal-overlay bg-black/[.2] fixed justify-center items-center top-0 left-0 flex w-full h-screen z-50">
            <Trap active={isOpen}>
                <div className="relative bg-white w-full max-w-xl p-10">
                    <CsrfForm action={action} method="post" csrfToken={csrfToken}>
                        <h1 className="govuk-heading-l">{questionText}</h1>

                        {hintText && (
                            <span className="govuk-hint" id="popup-hint">
                                {hintText}
                            </span>
                        )}

                        {hiddenInputs.map((hiddenInput) => (
                            <input
                                key={hiddenInput.name}
                                type="hidden"
                                name={hiddenInput.name}
                                value={hiddenInput.value || ""}
                            />
                        ))}

                        <button
                            className={`govuk-button mr-6 mt-4 mb-0 ${isWarning ? "govuk-button--warning" : ""}`}
                            data-module="govuk-button"
                            id="popup-continue-button"
                        >
                            {continueText}
                        </button>

                        <button
                            className="govuk-button govuk-button--secondary mr-6 mt-4 mb-0"
                            onClick={cancelActionHandler}
                            id="popup-cancel-button"
                        >
                            {cancelText}
                        </button>
                    </CsrfForm>
                </div>
            </Trap>
        </div>
    );
};

export default Popup;
