import React, { ReactElement } from "react";
import Popup from "./Popup";

interface PopUpProps {
    entityName: string;
    deleteUrl: string;
    cancelActionHandler: React.MouseEventHandler<HTMLButtonElement>;
    hintText?: string;
    csrfToken: string;
    hiddenInputs: { name: string; value: string | undefined }[];
    isWarning?: boolean;
    isOpen: boolean;
}

const DeleteConfirmationPopup = ({
    entityName,
    deleteUrl,
    cancelActionHandler,
    hintText,
    csrfToken,
    hiddenInputs,
    isWarning,
    isOpen,
}: PopUpProps): ReactElement | null => {
    return (
        <Popup
            isOpen={isOpen}
            action={deleteUrl}
            cancelActionHandler={cancelActionHandler}
            hintText={hintText}
            csrfToken={csrfToken}
            hiddenInputs={hiddenInputs}
            continueText="Yes, delete"
            cancelText="No, return"
            questionText={`Are you sure you wish to delete ${entityName.trim()}?`}
            isWarning={isWarning}
        />
    );
};

export default DeleteConfirmationPopup;
