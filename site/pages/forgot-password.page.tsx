import { NextPageContext } from "next";
import { parseCookies } from "nookies";
import { ReactElement, useState } from "react";
import CsrfForm from "../components/form/CsrfForm";
import ErrorSummary from "../components/form/ErrorSummary";
import TextInput from "../components/form/TextInput";
import { BaseLayout } from "../components/layout/Layout";
import { COOKIES_FORGOT_PASSWORD_ERRORS } from "../constants";
import { PageState } from "../interfaces";
import { ForgotPasswordSchema, forgotPasswordSchema } from "../schemas/forgot-password.schema";
import { destroyCookieOnResponseObject, getPageState } from "../utils/apiUtils";
import { getStateUpdater } from "../utils/formUtils";

const title = "Reset password - Create Transport Disruptions Service";
const description = "Password reset page for the Create Transport Disruptions Service";

export interface ForgotPasswordPageProps extends PageState<Partial<ForgotPasswordSchema>> {}
const ForgotPassword = (props: ForgotPasswordPageProps): ReactElement => {
    const [pageState, setPageState] = useState(props);
    const stateUpdater = getStateUpdater(setPageState, pageState);
    return (
        <BaseLayout title={title} description={description}>
            <h1 className="govuk-heading-xl">Forgot your password?</h1>
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    <>
                        <CsrfForm action="/api/forgot-password" method="post" csrfToken={pageState.csrfToken}>
                            <ErrorSummary errors={pageState.errors} />
                            <p className="govuk-body-m">Enter your email address to reset your password.</p>
                            <TextInput<ForgotPasswordSchema>
                                display="Email address"
                                inputName="email"
                                widthClass="w-3/4"
                                maxLength={100}
                                stateUpdater={stateUpdater}
                                initialErrors={pageState.errors}
                                value={pageState.inputs.email}
                            />
                            <button className="govuk-button">Continue</button>
                        </CsrfForm>
                    </>
                </div>
            </div>
        </BaseLayout>
    );
};

export const getServerSideProps = (ctx: NextPageContext): { props: ForgotPasswordPageProps } => {
    const cookies = parseCookies(ctx);
    const errorCookie = cookies[COOKIES_FORGOT_PASSWORD_ERRORS];

    if (ctx.res) destroyCookieOnResponseObject(COOKIES_FORGOT_PASSWORD_ERRORS, ctx.res);

    return {
        props: {
            ...getPageState(errorCookie, forgotPasswordSchema),
        },
    };
};

export default ForgotPassword;
