import { NetworkConsequence } from "@create-disruptions-data/shared-ts/disruptionTypes";
import { MAX_CONSEQUENCES, networkConsequenceSchema } from "@create-disruptions-data/shared-ts/disruptionTypes.zod";
import { fetchAdminAreas } from "@create-disruptions-data/shared-ts/utils/refDataApi";
import { NextPageContext, Redirect } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { parseCookies } from "nookies";
import { ReactElement, useState } from "react";
import { createChangeLink } from "../../../components/ReviewConsequenceTable";
import DeleteDisruptionButton from "../../../components/buttons/DeleteDisruptionButton";
import Checkbox from "../../../components/form/Checkbox";
import CsrfForm from "../../../components/form/CsrfForm";
import ErrorSummary from "../../../components/form/ErrorSummary";
import Radios from "../../../components/form/Radios";
import Select from "../../../components/form/Select";
import Table from "../../../components/form/Table";
import TextInput from "../../../components/form/TextInput";
import TimeSelector from "../../../components/form/TimeSelector";
import { BaseLayout } from "../../../components/layout/Layout";
import {
    ALLOWED_COACH_CONSEQUENCES,
    COOKIES_CONSEQUENCE_NETWORK_ERRORS,
    CREATE_CONSEQUENCE_NETWORK_PATH,
    DISRUPTION_DETAIL_PAGE_PATH,
    DISRUPTION_NOT_FOUND_ERROR_PAGE,
    DISRUPTION_SEVERITIES,
    ENABLE_COACH_MODE_FEATURE_FLAG,
    NETWORK_CONSEQUENCE_ADMIN_AREA_EXCLUSIONS,
    STAGE,
    TYPE_OF_CONSEQUENCE_PAGE_PATH,
} from "../../../constants";
import { getDisruptionById } from "../../../data/db";
import { CreateConsequenceProps, PageState } from "../../../interfaces";
import { filterVehicleModes, isNetworkConsequence } from "../../../utils";
import { destroyCookieOnResponseObject, getPageState } from "../../../utils/apiUtils";
import { getSessionWithOrgDetail } from "../../../utils/apiUtils/auth";
import { getStateUpdater, returnTemplateOverview, showCancelButton } from "../../../utils/formUtils";

const title = "Create Consequence Network";
const description = "Create Consequence Network page for the Create Transport Disruptions Service";

export interface CreateConsequenceNetworkProps extends PageState<Partial<NetworkConsequence>>, CreateConsequenceProps {}

const CreateConsequenceNetwork = (props: CreateConsequenceNetworkProps): ReactElement => {
    const [pageState, setConsequenceNetworkPageState] = useState<PageState<Partial<NetworkConsequence>>>(props);

    const stateUpdater = getStateUpdater(setConsequenceNetworkPageState, pageState);

    const queryParams = useRouter().query;
    const displayCancelButton = showCancelButton(queryParams);

    const returnToTemplateOverview = returnTemplateOverview(queryParams);

    const isTemplate = queryParams.template?.toString() ?? "";
    const returnPath = queryParams.return?.toString() ?? "";

    const { consequenceCount = 0 } = props;

    return (
        <BaseLayout title={title} description={description}>
            <CsrfForm
                action={`/api/create-consequence-network${isTemplate ? "?template=true" : ""}`}
                method="post"
                csrfToken={props.csrfToken}
            >
                <>
                    <ErrorSummary errors={props.errors} />
                    <div className="govuk-form-group">
                        <h1 className="govuk-heading-xl">Add a consequence</h1>
                        <Table
                            rows={[
                                {
                                    header: "Consequence type",
                                    cells: [
                                        "Network wide",
                                        createChangeLink(
                                            "consequence-type",
                                            TYPE_OF_CONSEQUENCE_PAGE_PATH,
                                            pageState.disruptionId || "",
                                            pageState.consequenceIndex ?? 0,
                                            returnToTemplateOverview || !!returnPath,
                                            returnToTemplateOverview ||
                                                returnPath?.includes(DISRUPTION_DETAIL_PAGE_PATH),
                                            !!isTemplate,
                                        ),
                                    ],
                                },
                            ]}
                        />

                        <Checkbox<NetworkConsequence>
                            inputName="disruptionArea"
                            displaySize="l"
                            hideLegend={false}
                            hint="Which area does the network cover?"
                            display="Disruption Area"
                            multiple
                            checkboxDetail={
                                props.disruptionAreas?.map((disruptionArea) => ({
                                    display: `${disruptionArea.name} - ${disruptionArea.administrativeAreaCode}`,
                                    value: disruptionArea.administrativeAreaCode,
                                    checked:
                                        pageState.inputs?.disruptionArea?.includes(
                                            disruptionArea.administrativeAreaCode,
                                        ) || false,
                                })) || []
                            }
                            stateUpdater={(value, _, checked) => {
                                let updatedDisruptionAreas = [...(pageState.inputs?.disruptionArea || [])];

                                if (checked) {
                                    if (!updatedDisruptionAreas.includes(value)) {
                                        updatedDisruptionAreas = [...updatedDisruptionAreas, value];
                                    }
                                } else {
                                    updatedDisruptionAreas =
                                        updatedDisruptionAreas?.filter((area) => area !== value) || [];
                                }
                                setConsequenceNetworkPageState({
                                    ...pageState,
                                    inputs: {
                                        ...(pageState.inputs || []),
                                        disruptionArea: updatedDisruptionAreas,
                                    },
                                });
                            }}
                            initialErrors={pageState.errors}
                        />

                        <Select<NetworkConsequence>
                            inputName="vehicleMode"
                            display="Mode of transport"
                            defaultDisplay="Select mode of transport"
                            selectValues={filterVehicleModes(props.showUnderground, props.showCoach)}
                            stateUpdater={stateUpdater}
                            value={pageState.inputs.vehicleMode}
                            initialErrors={pageState.errors}
                            displaySize="l"
                            hint={"Select a mode before continuing"}
                        />

                        <TextInput<NetworkConsequence>
                            display="Consequence description"
                            displaySize="l"
                            hint="What advice would you like to display?"
                            inputName="description"
                            widthClass="w-3/4"
                            textArea
                            rows={3}
                            maxLength={1000}
                            stateUpdater={stateUpdater}
                            value={pageState.inputs.description}
                            initialErrors={pageState.errors}
                        />

                        {!pageState.inputs.description ||
                        (pageState.inputs && pageState.inputs.description.length === 0) ? (
                            <button
                                className="mt-3 govuk-link"
                                data-module="govuk-button"
                                onClick={() => {
                                    props.disruptionDescription
                                        ? stateUpdater(props.disruptionDescription, "description")
                                        : "";
                                }}
                            >
                                <p className="text-govBlue govuk-body-m">Copy from disruption description</p>
                            </button>
                        ) : null}

                        <Radios<NetworkConsequence>
                            display="Remove from journey planners"
                            displaySize="l"
                            radioDetail={[
                                {
                                    value: "yes",
                                    display: "Yes",
                                },
                                {
                                    value: "no",
                                    display: "No",
                                },
                            ]}
                            inputName="removeFromJourneyPlanners"
                            stateUpdater={stateUpdater}
                            value={pageState.inputs.removeFromJourneyPlanners}
                            initialErrors={pageState.errors}
                        />

                        <TimeSelector<NetworkConsequence>
                            display="Delay (optional)"
                            hint="Enter time in minutes"
                            displaySize="l"
                            value={pageState.inputs.disruptionDelay}
                            inputName="disruptionDelay"
                            stateUpdater={stateUpdater}
                            initialErrors={pageState.errors}
                            placeholderValue=""
                        />

                        <Select<NetworkConsequence>
                            inputName="disruptionSeverity"
                            display="Disruption severity"
                            displaySize="l"
                            defaultDisplay="Select severity"
                            selectValues={DISRUPTION_SEVERITIES}
                            stateUpdater={stateUpdater}
                            value={pageState.inputs.disruptionSeverity}
                            initialErrors={pageState.errors}
                        />

                        <input type="hidden" name="consequenceType" value="networkWide" />
                        <input type="hidden" name="disruptionId" value={props.disruptionId} />
                        <input type="hidden" name="consequenceIndex" value={props.consequenceIndex} />

                        <button className="govuk-button mt-8" data-module="govuk-button">
                            Save and continue
                        </button>

                        {displayCancelButton && pageState.disruptionId ? (
                            <Link
                                role="button"
                                href={
                                    returnToTemplateOverview
                                        ? `${returnPath}/${pageState.disruptionId || ""}?template=true`
                                        : `${returnPath}/${pageState.disruptionId || ""}`
                                }
                                className="govuk-button mt-8 ml-5 govuk-button--secondary"
                            >
                                Cancel Changes
                            </Link>
                        ) : null}
                        {!isTemplate && (
                            <button
                                className="govuk-button mt-8 ml-5 govuk-button--secondary"
                                data-module="govuk-button"
                                formAction={`/api${CREATE_CONSEQUENCE_NETWORK_PATH}?draft=true`}
                            >
                                Save as draft
                            </button>
                        )}
                        <DeleteDisruptionButton
                            disruptionId={props.disruptionId}
                            csrfToken={props.csrfToken}
                            buttonClasses="mt-8"
                            isTemplate={isTemplate}
                            returnPath={returnPath}
                        />

                        {consequenceCount < (props.isEdit ? MAX_CONSEQUENCES : MAX_CONSEQUENCES - 1) && (
                            <button
                                formAction={`/api/create-consequence-network${
                                    isTemplate
                                        ? "?template=true&addAnotherConsequence=true"
                                        : "?addAnotherConsequence=true"
                                }`}
                                className="govuk-button mt-8 ml-5 govuk-button--secondary"
                                data-module="govuk-button"
                            >
                                Add another consequence
                            </button>
                        )}
                    </div>
                </>
            </CsrfForm>
        </BaseLayout>
    );
};

export const getServerSideProps = async (
    ctx: NextPageContext,
): Promise<{ props: object } | { redirect: Redirect } | undefined> => {
    const cookies = parseCookies(ctx);
    const errorCookie = cookies[COOKIES_CONSEQUENCE_NETWORK_ERRORS];

    if (!ctx.req) {
        throw new Error("No context request");
    }

    const session = await getSessionWithOrgDetail(ctx.req);

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

    const consequence = disruption?.consequences?.find((c) => c.consequenceIndex === index);

    const pageState = getPageState<NetworkConsequence>(
        errorCookie,
        networkConsequenceSchema,
        disruption.id,
        consequence && isNetworkConsequence(consequence) ? consequence : undefined,
    );

    const adminAreas = await fetchAdminAreas();

    if (ctx.res) destroyCookieOnResponseObject(COOKIES_CONSEQUENCE_NETWORK_ERRORS, ctx.res);

    return {
        props: {
            ...pageState,
            consequenceIndex: index,
            consequenceCount: disruption.consequences?.length ?? 0,
            disruptionDescription: disruption.description || "",
            template: disruption.template?.toString() || "",
            isEdit: !!consequence,
            showUnderground: session.showUnderground,
            showCoach: ENABLE_COACH_MODE_FEATURE_FLAG && ALLOWED_COACH_CONSEQUENCES.includes("network"),
            disruptionAreas: adminAreas.filter(
                (adminArea) =>
                    !NETWORK_CONSEQUENCE_ADMIN_AREA_EXCLUSIONS.includes(adminArea.administrativeAreaCode) &&
                    session.adminAreaCodes.includes(adminArea.administrativeAreaCode),
            ),
            stage: STAGE,
        },
    };
};

export default CreateConsequenceNetwork;
