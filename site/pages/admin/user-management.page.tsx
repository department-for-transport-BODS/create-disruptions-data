import { UserGroups } from "@create-disruptions-data/shared-ts/enums";
import { NextPageContext } from "next";
import Link from "next/link";
import { ReactElement, ReactNode, useState } from "react";
import Table from "../../components/form/Table";
import { BaseLayout } from "../../components/layout/Layout";
import PageNumbers from "../../components/layout/PageNumbers";
import DeleteConfirmationPopup from "../../components/popup/DeleteConfirmationPopup";
import Popup from "../../components/popup/Popup";
import { listUsersWithGroups } from "../../data/cognito";
import { UserManagementSchema } from "../../schemas/user-management.schema";
import { getSessionWithOrgDetail } from "../../utils/apiUtils/auth";
import { getDataInPages } from "../../utils/formUtils";
import { getAccountType } from "../../utils/tableUtils";

const title = "User Management";
const description = "User Management page for the Create Transport Disruptions Service";

export interface UserManagementPageProps {
    userList: UserManagementSchema;
    csrfToken?: string;
}

const UserManagement = ({ userList, csrfToken }: UserManagementPageProps): ReactElement => {
    const numberOfUserPages = Math.ceil(userList.length / 10);
    const [currentPage, setCurrentPage] = useState(1);
    const [userToDelete, setUserToDelete] = useState<string>();
    const [userToResendInvite, setUserToResendInvite] = useState<{
        username: string;
        userGroup: string;
    }>();

    const getRows = () => {
        const rows: { header?: string | ReactNode; cells: string[] | ReactNode[] }[] = [];
        getDataInPages(currentPage, userList).forEach((user, index) => {
            rows.push({
                cells: [
                    `${getAccountType(user.group)}`,
                    user.email,
                    user.userStatus === "CONFIRMED" ? "Active" : "Pending invite",
                    user.group !== UserGroups.systemAdmins
                        ? createLink("user-action", index, user.username, user.group, user.userStatus !== "CONFIRMED")
                        : "",
                ],
            });
        });
        return rows;
    };

    const removeUser = (username: string) => {
        setUserToDelete(username);
    };

    const cancelResendActionHandler = () => {
        setUserToResendInvite(undefined);
    };
    const resendInvite = (username: string, userGroup: string) => {
        setUserToResendInvite({ username, userGroup });
    };

    const cancelActionHandler = () => {
        setUserToDelete(undefined);
    };

    const createLink = (
        key: string,
        index: number,
        username: string,
        userGroup: string,
        showResendInvite?: boolean,
    ) => {
        return (
            <>
                {showResendInvite ? (
                    <>
                        <button
                            key={`${key}${index ? `-${index}` : ""}`}
                            className="govuk-link"
                            onClick={() => resendInvite(username, userGroup)}
                        >
                            Resend invite
                        </button>
                        <br />
                        <Link className="govuk-link" href={`/admin/edit-user/${username}`}>
                            Edit
                        </Link>
                        <br />
                        <button
                            key={`${key}${index ? `-remove-${index}` : "-remove"}`}
                            className="govuk-link"
                            onClick={() => removeUser(username)}
                        >
                            Remove
                        </button>
                    </>
                ) : (
                    <>
                        <Link className="govuk-link" href={`/admin/edit-user/${username}`}>
                            Edit
                        </Link>
                        <br />
                        <button
                            key={`${key}${index ? `-${index}` : ""}`}
                            className="govuk-link"
                            onClick={() => removeUser(username)}
                        >
                            Remove
                        </button>
                    </>
                )}
            </>
        );
    };

    return (
        <BaseLayout title={title} description={description}>
            <>
                {userToDelete ? (
                    <DeleteConfirmationPopup
                        entityName="user"
                        deleteUrl="/api/admin/delete-user"
                        cancelActionHandler={cancelActionHandler}
                        csrfToken={csrfToken || ""}
                        hiddenInputs={[
                            {
                                name: "username",
                                value: userToDelete,
                            },
                        ]}
                        isOpen={!!userToDelete}
                    />
                ) : null}
                {userToResendInvite ? (
                    <Popup
                        action={"/api/admin/resend-invite"}
                        cancelActionHandler={cancelResendActionHandler}
                        csrfToken={csrfToken || ""}
                        continueText="Yes, resend"
                        cancelText="No, return"
                        hiddenInputs={[
                            {
                                name: "username",
                                value: userToResendInvite.username,
                            },
                            {
                                name: "group",
                                value: userToResendInvite.userGroup,
                            },
                        ]}
                        questionText={"Are you sure you wish to resend the invite?"}
                        isOpen={!!userToResendInvite}
                    />
                ) : null}
                <div className="govuk-form-group">
                    <h1 className="govuk-heading-xl">User Management</h1>
                </div>
                <Table
                    caption={{ text: "Users", size: "m" }}
                    columns={["Account type", "User email", "Status", "Action"]}
                    rows={getRows()}
                />
                <Link role="button" href={"/admin/add-user"} className="govuk-button--secondary govuk-button mt-5 mr-5">
                    Add new user
                </Link>
                <Link role="button" href={"/admin/add-operator"} className="govuk-button--secondary govuk-button mt-5">
                    Add new Operator
                </Link>
                <PageNumbers
                    numberOfPages={numberOfUserPages}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                />
            </>
        </BaseLayout>
    );
};

export const getServerSideProps = async (ctx: NextPageContext): Promise<{ props: UserManagementPageProps }> => {
    if (!ctx.req) {
        throw new Error("No context request");
    }

    const sessionWithOrg = await getSessionWithOrgDetail(ctx.req);
    if (!sessionWithOrg) {
        throw new Error("No session found");
    }
    const userRecords = await listUsersWithGroups();

    if (!userRecords) {
        return {
            props: {
                userList: [],
            },
        };
    }

    const userList = userRecords
        .filter((user) => user.organisation === sessionWithOrg.orgId)
        .sort((a, b) => {
            return a.email.toLowerCase().localeCompare(b.email.toLowerCase(), "en", { numeric: true });
        });

    return {
        props: { userList },
    };
};

export default UserManagement;
