import { NextPageContext, Redirect } from "next";
import { parseCookies } from "nookies";
import { ReactElement, useState } from "react";
import CsrfForm from "../components/form/CsrfForm";
import ErrorSummary from "../components/form/ErrorSummary";
import TextInput from "../components/form/TextInput";
import { BaseLayout } from "../components/layout/Layout";
import { COOKIES_LOGIN_ERRORS, DASHBOARD_PAGE_PATH } from "../constants";
import { PageState } from "../interfaces";
import { LoginSchema, loginSchema } from "../schemas/login.schema";
import { destroyCookieOnResponseObject, getPageState } from "../utils/apiUtils";
import { getSession } from "../utils/apiUtils/auth";
import { getStateUpdater } from "../utils/formUtils";

const title = "Sign in - Create Transport Disruptions Service";
const description = "Login page for the Create Transport Disruptions Service";

export interface LoginPageProps extends PageState<Partial<LoginSchema>> {}

const Login = (props: LoginPageProps): ReactElement => {
    const [pageState, setPageState] = useState(props);

    const stateUpdater = getStateUpdater(setPageState, pageState);

    return (
        <BaseLayout title={title} description={description} errors={pageState.errors} disableBackButton>
            <h1 className="govuk-heading-xl">Sign in</h1>
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    <CsrfForm action="/api/login" method="post" csrfToken={pageState.csrfToken}>
                        <>
                            <ErrorSummary errors={pageState.errors} />

                            <h2 className="govuk-heading-m w-3/4">
                                Enter your Create Transport Disruption Data account details to sign in
                            </h2>

                            <TextInput<LoginSchema>
                                display="Email address"
                                inputName="email"
                                widthClass="w-3/4"
                                value={pageState.inputs.email}
                                initialErrors={pageState.errors}
                                stateUpdater={stateUpdater}
                                maxLength={100}
                            />

                            <TextInput<LoginSchema>
                                display="Password"
                                inputName="password"
                                widthClass="w-3/4"
                                value={pageState.inputs.password}
                                initialErrors={pageState.errors}
                                stateUpdater={stateUpdater}
                                maxLength={100}
                                isPassword
                            />

                            <button className="govuk-button mt-8">Sign In</button>
                        </>
                    </CsrfForm>
                </div>
                <div className="govuk-grid-column-one-third">
                    <div>
                        <h2 className="govuk-heading-m">Forgot your password?</h2>
                        <a href="/forgot-password" className="govuk-link govuk-!-font-size-19">
                            Reset your password
                        </a>
                    </div>
                </div>
            </div>
        </BaseLayout>
    );
};

export const getServerSideProps = (ctx: NextPageContext): { props: LoginPageProps } | { redirect: Redirect } => {
    const cookies = parseCookies(ctx);
    const errorCookie = cookies[COOKIES_LOGIN_ERRORS];

    if (ctx.res) destroyCookieOnResponseObject(COOKIES_LOGIN_ERRORS, ctx.res);

    if (ctx.req) {
        const session = getSession(ctx.req);

        if (session) {
            return {
                redirect: {
                    destination: DASHBOARD_PAGE_PATH,
                    statusCode: 302,
                },
            };
        }
    }
    return {
        props: {
            ...getPageState(errorCookie, loginSchema),
        },
    };
};

export default Login;
