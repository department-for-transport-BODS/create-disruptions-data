import { UserGroups } from "@create-disruptions-data/shared-ts/enums";
import { NextPageContext } from "next";
import { useRouter } from "next/router";
import { parseCookies } from "nookies";
import { ReactElement, ReactNode, SyntheticEvent, useState } from "react";
import CsrfForm from "../../components/form/CsrfForm";
import ErrorSummary from "../../components/form/ErrorSummary";
import Table from "../../components/form/Table";
import TextInput from "../../components/form/TextInput";
import { BaseLayout } from "../../components/layout/Layout";
import DeleteConfirmationPopup from "../../components/popup/DeleteConfirmationPopup";
import Popup from "../../components/popup/Popup";
import { COOKIES_ADD_ADMIN_USER_ERRORS } from "../../constants";
import { listUsersWithGroups } from "../../data/cognito";
import { getOrganisationInfoById } from "../../data/dynamo";
import { PageState } from "../../interfaces";
import { AddUserSchema, addUserSchema } from "../../schemas/add-user.schema";
import { UserManagementSchema } from "../../schemas/user-management.schema";
import { destroyCookieOnResponseObject, getPageState } from "../../utils/apiUtils";
import { getSessionWithOrgDetail } from "../../utils/apiUtils/auth";
import { getStateUpdater } from "../../utils/formUtils";
import { getAccountType } from "../../utils/tableUtils";

const title = "System admins - Create Transport Disruptions Service";
const description = "System admins user page for the Create Transport Disruptions Service";

export interface SysAdminUserManagementProps extends PageState<Partial<AddUserSchema>> {
    users?: UserManagementSchema;
    orgName?: string;
}
const SysAdminUserManagement = (props: SysAdminUserManagementProps): ReactElement => {
    const [pageState, setPageState] = useState(props);
    const [userToDelete, setUserToDelete] = useState<string>();
    const [userToResendInvite, setUserToResendInvite] = useState<{
        username: string;
        userGroup: string;
        userOrgId: string;
    }>();

    const stateUpdater = getStateUpdater(setPageState, pageState);

    const getRows = () => {
        const rows: { header?: string | ReactNode; cells: string[] | ReactNode[] }[] = [];
        props.users?.forEach((user, index) => {
            rows.push({
                cells: [
                    user.givenName,
                    user.familyName,
                    user.email,
                    `${getAccountType(user.group)}`,
                    user.group !== UserGroups.systemAdmins
                        ? createLink(
                              "user-action",
                              index,
                              user.username,
                              user.group,
                              user.organisation,
                              user.userStatus !== "CONFIRMED" && user.group === UserGroups.orgAdmins,
                          )
                        : "",
                    user.userStatus === "FORCE_CHANGE_PASSWORD" ? "Unregistered" : "Registered",
                ],
            });
        });
        return rows;
    };

    const createLink = (
        key: string,
        index: number,
        username: string,
        userGroup: string,
        userOrgId: string,
        showResendInvite?: boolean,
    ) => {
        return (
            <>
                {showResendInvite ? (
                    <>
                        <button
                            key={`${key}${index ? `-${index}` : ""}`}
                            className="govuk-link"
                            onClick={(e: SyntheticEvent) => {
                                e.preventDefault();
                                resendInvite(username, userGroup, userOrgId);
                            }}
                        >
                            Resend invite
                        </button>
                        <br />
                        <button
                            key={`${key}${index ? `-remove-${index}` : "-remove"}`}
                            className="govuk-link"
                            onClick={(e) => {
                                e.preventDefault();
                                removeUser(username);
                            }}
                        >
                            Remove
                        </button>
                    </>
                ) : (
                    <button
                        key={`${key}${index ? `-${index}` : ""}`}
                        className="govuk-link"
                        onClick={(e) => {
                            e.preventDefault();
                            removeUser(username);
                        }}
                    >
                        Remove
                    </button>
                )}
            </>
        );
    };

    const removeUser = (username: string) => {
        setUserToDelete(username);
    };

    const cancelResendActionHandler = () => {
        setUserToResendInvite(undefined);
    };
    const resendInvite = (username: string, userGroup: string, userOrgId: string) => {
        setUserToResendInvite({ username, userGroup, userOrgId });
    };

    const cancelActionHandler = () => {
        setUserToDelete(undefined);
    };

    const queryParams = useRouter().query;

    const orgId = queryParams.orgId;

    return (
        <BaseLayout title={title} description={description} errors={pageState.errors}>
            {userToDelete ? (
                <DeleteConfirmationPopup
                    entityName="user"
                    deleteUrl="/api/admin/delete-user"
                    cancelActionHandler={cancelActionHandler}
                    csrfToken={pageState.csrfToken || ""}
                    hiddenInputs={[
                        {
                            name: "username",
                            value: userToDelete,
                        },
                        {
                            name: "orgId",
                            value: orgId?.toString(),
                        },
                    ]}
                    isOpen={!!userToDelete}
                />
            ) : null}
            {userToResendInvite ? (
                <Popup
                    action={"/api/admin/resend-invite"}
                    cancelActionHandler={cancelResendActionHandler}
                    csrfToken={pageState.csrfToken || ""}
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
                        {
                            name: "orgId",
                            value: userToResendInvite.userOrgId,
                        },
                    ]}
                    questionText={"Are you sure you wish to resend the invite?"}
                    isOpen={!!userToResendInvite}
                />
            ) : null}
            <ErrorSummary errors={pageState.errors} />
            <h1 className="govuk-heading-l">Add {props.orgName} admin</h1>
            <p className="govuk-body">
                Users added below will be set up as admins for their respective organisations. They will have the
                ability to perform all functionality available within the tool, including the ability to set up further
                admin users on their own and users with lower permission settings. Users of any account type added by
                the organisations admin will also appear in the list of users below
            </p>
            <CsrfForm action="/api/sysadmin/users" method="post" csrfToken={props.csrfToken}>
                <TextInput<AddUserSchema>
                    display="Admin first name"
                    inputName="givenName"
                    widthClass="w"
                    value={pageState.inputs.givenName}
                    initialErrors={pageState.errors}
                    schema={addUserSchema.shape.givenName}
                    stateUpdater={stateUpdater}
                    maxLength={100}
                />
                <TextInput<AddUserSchema>
                    display="Admin last name"
                    inputName="familyName"
                    widthClass="w"
                    value={pageState.inputs.familyName}
                    initialErrors={pageState.errors}
                    schema={addUserSchema.shape.familyName}
                    stateUpdater={stateUpdater}
                    maxLength={100}
                />
                <TextInput<AddUserSchema>
                    display="Admin email address"
                    inputName="email"
                    widthClass="w"
                    value={pageState.inputs.email}
                    initialErrors={pageState.errors}
                    schema={addUserSchema.shape.email}
                    stateUpdater={stateUpdater}
                    maxLength={100}
                />

                <input type="hidden" name="orgId" value={orgId} />
                <input type="hidden" name="group" value={UserGroups.orgAdmins} />

                <button className="govuk-button mt-8" data-module="govuk-button">
                    Add and send invite
                </button>
                <Table
                    columns={["First name", "Last name", "Email", "Account type", "Action", "Status"]}
                    rows={getRows()}
                />
            </CsrfForm>
        </BaseLayout>
    );
};

export const getServerSideProps = async (ctx: NextPageContext): Promise<{ props: SysAdminUserManagementProps }> => {
    const cookies = parseCookies(ctx);
    const errorCookie = cookies[COOKIES_ADD_ADMIN_USER_ERRORS];

    if (!ctx.req) {
        throw new Error("No context request");
    }

    if (ctx.res) destroyCookieOnResponseObject(COOKIES_ADD_ADMIN_USER_ERRORS, ctx.res);

    const session = await getSessionWithOrgDetail(ctx.req);

    if (!session) {
        throw new Error("No session found");
    }
    if (!session.isSystemAdmin) {
        throw new Error("Invalid user accessing the page");
    }

    const orgId = ctx.query.orgId?.toString() || "";

    const orgInfo = await getOrganisationInfoById(orgId);

    const orgName = orgInfo?.name ? orgInfo.name : "";

    const orgAdminUsers = await listUsersWithGroups();

    const sortedAndFilteredUsersList = orgAdminUsers
        .filter((user) => user.organisation === orgId)
        .sort((a, b) => a.givenName.localeCompare(b.givenName));

    return {
        props: {
            ...getPageState(errorCookie, addUserSchema),
            users: sortedAndFilteredUsersList,
            orgName: orgName,
        },
    };
};

export default SysAdminUserManagement;
