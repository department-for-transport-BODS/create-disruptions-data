import { NextPageContext } from "next";
import { parseCookies } from "nookies";
import { ReactElement, useState } from "react";
import CsrfForm from "../components/form/CsrfForm";
import ErrorSummary from "../components/form/ErrorSummary";
import Table from "../components/form/Table";
import TextInput from "../components/form/TextInput";
import { BaseLayout } from "../components/layout/Layout";
import { COOKIES_REGISTER_ERRORS, MIN_PASSWORD_LENGTH } from "../constants";
import { getOrganisationInfoById } from "../data/dynamo";
import { PageState } from "../interfaces";
import { RegisterSchema, registerSchema } from "../schemas/register.schema";
import { getPageState, redirectToError } from "../utils/apiUtils";
import { getStateUpdater } from "../utils/formUtils";

const title = "Register - Create Transport Disruptions Service";
const description = "Register page for the Create Transport Disruptions Service";

export interface RegisterPageProps extends PageState<Partial<RegisterSchema>> {}

const Register = (props: RegisterPageProps): ReactElement => {
    const [pageState, setPageState] = useState(props);

    const stateUpdater = getStateUpdater(setPageState, pageState);

    const getRows = (email: string, organisationName?: string) => {
        const rows = [
            {
                header: "Email address",
                cells: [email],
            },
        ];

        if (organisationName) {
            rows.push({
                header: "Organisation",
                cells: [organisationName],
            });
        }

        return rows;
    };

    return (
        <BaseLayout title={title} description={description} errors={pageState.errors} disableBackButton>
            <h1 className="govuk-heading-xl">Create an account</h1>
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    <CsrfForm action="/api/register" method="post" csrfToken={pageState.csrfToken}>
                        <>
                            <ErrorSummary errors={pageState.errors} />

                            <Table rows={getRows(pageState.inputs.email || "", pageState.inputs.organisationName)} />

                            <TextInput<RegisterSchema>
                                display="Password"
                                inputName="password"
                                hint={`Your password should be at least ${MIN_PASSWORD_LENGTH} characters long and contain at least 1 uppercase letter, 1 lowercase letter, 1 number and 1 special character.`}
                                widthClass="w-3/4"
                                value={pageState.inputs.password}
                                initialErrors={pageState.errors}
                                stateUpdater={stateUpdater}
                                maxLength={100}
                                isPassword
                            />

                            <TextInput<RegisterSchema>
                                display="Confirm password"
                                inputName="confirmPassword"
                                widthClass="w-3/4"
                                value={pageState.inputs.confirmPassword}
                                initialErrors={pageState.errors}
                                stateUpdater={stateUpdater}
                                maxLength={100}
                                isPassword
                            />

                            <input type="hidden" name="email" value={pageState.inputs.email} />
                            <input type="hidden" name="key" value={pageState.inputs.key} />
                            <input type="hidden" name="orgId" value={pageState.inputs.orgId} />

                            <button className="govuk-button mt-8">Save password</button>
                        </>
                    </CsrfForm>
                </div>
            </div>
        </BaseLayout>
    );
};

export const getServerSideProps = async (ctx: NextPageContext): Promise<{ props: RegisterPageProps } | undefined> => {
    const cookies = parseCookies(ctx);
    const errorCookie = cookies[COOKIES_REGISTER_ERRORS];

    const { key, email, orgId } = ctx.query;
    if (!key || !email || !orgId) {
        if (ctx.res) {
            redirectToError(ctx.res);
        }

        return;
    }

    const orgDetail = await getOrganisationInfoById(orgId.toString());

    const pageState = getPageState(errorCookie, registerSchema);

    pageState.inputs.key = key.toString();
    pageState.inputs.email = email.toString();
    pageState.inputs.organisationName = orgDetail?.name;
    pageState.inputs.orgId = orgId.toString();

    return {
        props: {
            ...pageState,
        },
    };
};

export default Register;
