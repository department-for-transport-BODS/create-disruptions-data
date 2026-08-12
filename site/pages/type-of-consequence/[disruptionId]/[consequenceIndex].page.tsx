import { NextPageContext, Redirect } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { parseCookies } from "nookies";
import { ReactElement, useState } from "react";
import DeleteDisruptionButton from "../../../components/buttons/DeleteDisruptionButton";
import CsrfForm from "../../../components/form/CsrfForm";
import ErrorSummary from "../../../components/form/ErrorSummary";
import Radios from "../../../components/form/Radios";
import { TwoThirdsLayout } from "../../../components/layout/Layout";
import {
    CONSEQUENCE_TYPES,
    COOKIES_CONSEQUENCE_TYPE_ERRORS,
    DISRUPTION_NOT_FOUND_ERROR_PAGE,
    ENABLE_CANCELLATIONS_FEATURE_FLAG,
    OPERATOR_USER_CONSEQUENCE_TYPES,
} from "../../../constants/index";
import { getDisruptionById } from "../../../data/db";
import { PageState } from "../../../interfaces/index";
import { ConsequenceType, typeOfConsequenceSchema } from "../../../schemas/type-of-consequence.schema";
import { destroyCookieOnResponseObject, getPageState } from "../../../utils/apiUtils";
import { getSession } from "../../../utils/apiUtils/auth";
import { getStateUpdater, returnTemplateOverview, showCancelButton } from "../../../utils/formUtils";

const title = "Create Consequences";
const description = "Create Consequences page for the Create Transport Disruptions Service";

export interface ConsequenceTypePageProps extends PageState<Partial<ConsequenceType>> {
    isOperatorUser?: boolean;
    enableCancellationsFeatureFlag?: boolean;
}

const TypeOfConsequence = (props: ConsequenceTypePageProps): ReactElement => {
    const [pageState, setPageState] = useState(props);

    const stateUpdater = getStateUpdater(setPageState, pageState);

    const router = useRouter();
    const queryParams = router.query;
    const displayCancelButton = showCancelButton(queryParams);

    const returnToTemplateOverview = returnTemplateOverview(queryParams);

    const isTemplate = queryParams.template?.toString() ?? "";
    const returnPath = queryParams.return?.toString() ?? "";

    const consequenceTypesRadioDetail = props.isOperatorUser
        ? OPERATOR_USER_CONSEQUENCE_TYPES(props.enableCancellationsFeatureFlag ?? false)
        : CONSEQUENCE_TYPES(props.enableCancellationsFeatureFlag ?? false);

    return (
        <TwoThirdsLayout title={title} description={description} errors={props.errors}>
            <CsrfForm
                action={`/api/type-of-consequence${isTemplate ? "?template=true" : ""}`}
                method="post"
                csrfToken={props.csrfToken}
            >
                <>
                    <ErrorSummary errors={props.errors} />
                    <div className="govuk-form-group">
                        <h1 className="govuk-heading-xl">Add a consequence</h1>

                        <Radios<ConsequenceType>
                            display="Select consequence type"
                            radioDetail={consequenceTypesRadioDetail}
                            inputName="consequenceType"
                            stateUpdater={stateUpdater}
                            value={pageState.inputs.consequenceType}
                            initialErrors={props.errors}
                            paddingTop={3}
                        />

                        <input type="hidden" name="disruptionId" value={props.disruptionId} />
                        <input type="hidden" name="consequenceIndex" value={props.consequenceIndex} />

                        <div className="govuk-button-group">
                            <button className="govuk-button" data-module="govuk-button">
                                Save and continue
                            </button>

                            {displayCancelButton ? (
                                <Link
                                    role="button"
                                    href={
                                        returnToTemplateOverview
                                            ? `${returnPath}/${pageState.disruptionId || ""}?template=true`
                                            : `${returnPath}/${pageState.disruptionId || ""}`
                                    }
                                    className="govuk-button mt-8 ml-1 govuk-button--secondary"
                                >
                                    Cancel Changes
                                </Link>
                            ) : (
                                <></>
                            )}

                            <DeleteDisruptionButton
                                disruptionId={props.disruptionId}
                                csrfToken={props.csrfToken}
                                isTemplate={isTemplate}
                                returnPath={returnPath}
                            />
                        </div>
                    </div>
                </>
            </CsrfForm>
        </TwoThirdsLayout>
    );
};

export const getServerSideProps = async (
    ctx: NextPageContext,
): Promise<{ props: ConsequenceTypePageProps } | { redirect: Redirect } | undefined> => {
    const cookies = parseCookies(ctx);
    const errorCookie = cookies[COOKIES_CONSEQUENCE_TYPE_ERRORS];

    if (!ctx.req) {
        throw new Error("No context request");
    }

    const session = getSession(ctx.req);

    if (!session) {
        throw new Error("No session found");
    }

    const disruption = await getDisruptionById(ctx.query.disruptionId?.toString() ?? "", session.orgId);

    if (!disruption) {
        return {
            redirect: {
                destination: `${DISRUPTION_NOT_FOUND_ERROR_PAGE}${ctx.query?.template ? "?template=true" : ""}`,
                statusCode: 302,
            },
        };
    }

    const index = ctx.query.consequenceIndex ? Number(ctx.query.consequenceIndex) : 0;

    if (ctx.res) destroyCookieOnResponseObject(COOKIES_CONSEQUENCE_TYPE_ERRORS, ctx.res);

    return {
        props: {
            ...getPageState(
                errorCookie,
                typeOfConsequenceSchema,
                ctx.query.disruptionId?.toString(),
                disruption?.consequences?.find((c) => c.consequenceIndex === index) ?? undefined,
            ),
            consequenceIndex: index,
            isOperatorUser: session.isOperatorUser,
            enableCancellationsFeatureFlag: ENABLE_CANCELLATIONS_FEATURE_FLAG,
        },
    };
};

export default TypeOfConsequence;
