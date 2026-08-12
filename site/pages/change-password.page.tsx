import { NextPageContext } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { parseCookies } from "nookies";
import { ReactElement, useState } from "react";
import CsrfForm from "../components/form/CsrfForm";
import ErrorSummary from "../components/form/ErrorSummary";
import Table from "../components/form/Table";
import TextInput from "../components/form/TextInput";
import { TwoThirdsLayout } from "../components/layout/Layout";
import { ACCOUNT_SETTINGS_PAGE_PATH, COOKIES_CHANGE_PASSWORD_ERRORS, MIN_PASSWORD_LENGTH } from "../constants";
import { PageState } from "../interfaces";
import { ChangePasswordSchema, changePasswordSchemaRefined } from "../schemas/change-password.schema";
import { getPageState } from "../utils/apiUtils";
import { getSessionWithOrgDetail } from "../utils/apiUtils/auth";
import { getStateUpdater } from "../utils/formUtils";

const title = "Change Password - Create Transport Disruptions Service";
const description = "Change Password page for the Create Transport Disruptions Service";

export interface ChangePasswordPageProps extends PageState<Partial<ChangePasswordSchema>> {}

const ChangePassword = (props: ChangePasswordPageProps): ReactElement => {
    const [pageState, setPageState] = useState(props);

    const stateUpdater = getStateUpdater(setPageState, pageState);

    const queryParams = useRouter().query;
    const displaySuccessMessage = queryParams.success;

    return (
        <TwoThirdsLayout title={title} description={description} errors={pageState.errors}>
            <CsrfForm action="/api/change-password" method="post" csrfToken={pageState.csrfToken}>
                <>
                    <ErrorSummary errors={pageState.errors} />
                    <h1 className="govuk-heading-xl">Change password</h1>
                    {displaySuccessMessage ? (
                        <>
                            <h2 className="govuk-heading-m">Your password has been successfully updated.</h2>
                            <Link role="button" href={ACCOUNT_SETTINGS_PAGE_PATH} className="govuk-button mt-8">
                                Return to account settings
                            </Link>
                        </>
                    ) : (
                        <>
                            <Table
                                rows={[
                                    {
                                        header: "Email address",
                                        cells: [pageState.sessionWithOrg?.email],
                                    },
                                    {
                                        header: "Organisation",
                                        cells: [pageState.sessionWithOrg?.orgName],
                                    },
                                ]}
                            />
                            <TextInput<ChangePasswordSchema>
                                display="Current password"
                                inputName="currentPassword"
                                widthClass="w"
                                value={pageState.inputs.currentPassword}
                                initialErrors={pageState.errors}
                                stateUpdater={stateUpdater}
                                maxLength={100}
                                isPassword
                            />

                            <TextInput<ChangePasswordSchema>
                                display="New password"
                                inputName="newPassword"
                                widthClass="w"
                                value={pageState.inputs.newPassword}
                                initialErrors={pageState.errors}
                                stateUpdater={stateUpdater}
                                maxLength={100}
                                hint={`Your password should be at least ${MIN_PASSWORD_LENGTH} characters long and contain at least 1 uppercase letter, 1 lowercase letter, 1 number and 1 special character.`}
                                isPassword
                            />

                            <TextInput<ChangePasswordSchema>
                                display="Confirm new password"
                                inputName="confirmPassword"
                                widthClass="w"
                                value={pageState.inputs.confirmPassword}
                                initialErrors={pageState.errors}
                                stateUpdater={stateUpdater}
                                maxLength={100}
                                isPassword
                            />

                            <button className="govuk-button mt-8">Save password</button>
                            <Link
                                role="button"
                                href={ACCOUNT_SETTINGS_PAGE_PATH}
                                className="govuk-button mt-8 ml-10 govuk-button--secondary"
                            >
                                Cancel
                            </Link>
                        </>
                    )}
                </>
            </CsrfForm>
        </TwoThirdsLayout>
    );
};

export const getServerSideProps = async (ctx: NextPageContext): Promise<{ props: ChangePasswordPageProps }> => {
    const cookies = parseCookies(ctx);
    const errorCookie = cookies[COOKIES_CHANGE_PASSWORD_ERRORS];

    if (!ctx.req) {
        throw new Error("No context request");
    }

    const session = await getSessionWithOrgDetail(ctx.req);

    if (!session) {
        throw new Error("No session found");
    }

    return {
        props: {
            ...getPageState(errorCookie, changePasswordSchemaRefined),
            sessionWithOrg: session,
        },
    };
};

export default ChangePassword;
