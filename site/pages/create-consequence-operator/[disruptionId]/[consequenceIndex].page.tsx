import { OperatorConsequence } from "@create-disruptions-data/shared-ts/disruptionTypes";
import { MAX_CONSEQUENCES, operatorConsequenceSchema } from "@create-disruptions-data/shared-ts/disruptionTypes.zod";
import { Datasource, VehicleMode } from "@create-disruptions-data/shared-ts/enums";
import { NextPageContext, Redirect } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { parseCookies } from "nookies";
import { ReactElement, useEffect, useState } from "react";
import { createChangeLink } from "../../../components/ReviewConsequenceTable";
import DeleteDisruptionButton from "../../../components/buttons/DeleteDisruptionButton";
import CsrfForm from "../../../components/form/CsrfForm";
import ErrorSummary from "../../../components/form/ErrorSummary";
import Radios from "../../../components/form/Radios";
import Select from "../../../components/form/Select";
import Table from "../../../components/form/Table";
import TextInput from "../../../components/form/TextInput";
import TimeSelector from "../../../components/form/TimeSelector";
import { BaseLayout } from "../../../components/layout/Layout";
import OperatorSearch from "../../../components/search/OperatorSearch";
import {
    ALLOWED_COACH_CONSEQUENCES,
    COOKIES_CONSEQUENCE_OPERATOR_ERRORS,
    CREATE_CONSEQUENCE_OPERATOR_PATH,
    DISRUPTION_DETAIL_PAGE_PATH,
    DISRUPTION_NOT_FOUND_ERROR_PAGE,
    DISRUPTION_SEVERITIES,
    ENABLE_COACH_MODE_FEATURE_FLAG,
    TYPE_OF_CONSEQUENCE_PAGE_PATH,
} from "../../../constants";
import { getDisruptionById } from "../../../data/db";
import { getNocCodesForOperatorOrg } from "../../../data/dynamo";
import { fetchOperators } from "../../../data/refDataApi";
import { CreateConsequenceProps, PageState } from "../../../interfaces";
import { Operator } from "../../../schemas/consequence.schema";
import { ModeType } from "../../../schemas/organisation.schema";
import { filterVehicleModes, isOperatorConsequence } from "../../../utils";
import { destroyCookieOnResponseObject, getPageState } from "../../../utils/apiUtils";
import { getSessionWithOrgDetail } from "../../../utils/apiUtils/auth";
import {
    getStateUpdater,
    operatorStateUpdater,
    returnTemplateOverview,
    showCancelButton,
} from "../../../utils/formUtils";

const title = "Create Consequence Operator";
const description = "Create Consequence Operator page for the Create Transport Disruptions Service";

export interface CreateConsequenceOperatorProps
    extends PageState<Partial<OperatorConsequence>>,
        CreateConsequenceProps {
    operators: Operator[];
}

const CreateConsequenceOperator = (props: CreateConsequenceOperatorProps): ReactElement => {
    const [pageState, setConsequenceOperatorPageState] = useState<PageState<Partial<OperatorConsequence>>>(props);

    const stateUpdater = getStateUpdater(setConsequenceOperatorPageState, pageState);

    const operatorStateUpdate = operatorStateUpdater(setConsequenceOperatorPageState, pageState);

    const queryParams = useRouter().query;
    const displayCancelButton = showCancelButton(queryParams);

    const returnToTemplateOverview = returnTemplateOverview(queryParams);

    const isTemplate = queryParams.template?.toString() ?? "";
    const returnPath = queryParams.return?.toString() ?? "";

    const [dataSource, setDataSource] = useState<Datasource>(Datasource.bods);

    const { consequenceCount = 0 } = props;

    useEffect(() => {
        const source = props.sessionWithOrg?.mode[pageState?.inputs?.vehicleMode as keyof ModeType];
        if (source && dataSource !== source) {
            setDataSource(source);
        }
    }, [pageState?.inputs?.vehicleMode]);

    const filterOperators = (operator: Operator) => {
        const display =
            !pageState.inputs.consequenceOperators?.find((selOp) => selOp.operatorNoc === operator.nocCode) &&
            operator.dataSource === dataSource.toString();

        if (pageState.inputs?.vehicleMode === VehicleMode.coach && operator.mode === VehicleMode.coach.toString()) {
            return display;
        }
        if (
            pageState.inputs?.vehicleMode === VehicleMode.bus &&
            (operator.mode === VehicleMode.bus.toString() || operator.mode === "")
        ) {
            return display;
        }
        if (
            pageState.inputs?.vehicleMode === VehicleMode.tram &&
            (operator.mode === VehicleMode.tram.toString() || operator.mode === "metro")
        ) {
            return display;
        }
        if (pageState.inputs?.vehicleMode === VehicleMode.ferryService && operator.mode === "ferry") {
            return display;
        }
        if (
            pageState.inputs?.vehicleMode === VehicleMode.underground &&
            operator.mode === VehicleMode.underground.toString()
        ) {
            return display;
        }
        if (pageState.inputs?.vehicleMode === operator.mode) {
            return display;
        }
        return false;
    };

    return (
        <BaseLayout title={title} description={description}>
            <CsrfForm
                action={`/api/create-consequence-operator${isTemplate ? "?template=true" : ""}`}
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
                                        "Operator wide",
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
                        <Select<OperatorConsequence>
                            inputName="vehicleMode"
                            display="Mode of transport"
                            defaultDisplay="Select mode of transport"
                            selectValues={filterVehicleModes(props.showUnderground, props.showCoach)}
                            stateUpdater={stateUpdater}
                            value={pageState.inputs.vehicleMode}
                            initialErrors={pageState.errors}
                            schema={operatorConsequenceSchema.shape.vehicleMode}
                            displaySize="l"
                            hint={"Select a mode before continuing"}
                        />

                        <OperatorSearch<OperatorConsequence>
                            display="Operators impacted"
                            displaySize="l"
                            operators={
                                props.session?.isOperatorUser
                                    ? props.operators
                                    : props.operators.filter((op) => filterOperators(op))
                            }
                            selectedOperators={pageState.inputs?.consequenceOperators ?? []}
                            stateUpdater={operatorStateUpdate}
                            initialErrors={pageState.inputs.consequenceOperators?.length === 0 ? pageState.errors : []}
                            inputName="consequenceOperators"
                        />
                        {pageState.inputs.consequenceOperators && pageState.inputs.consequenceOperators.length > 0 ? (
                            <Table
                                rows={pageState.inputs.consequenceOperators
                                    .sort((a, b) => {
                                        return a.operatorPublicName.localeCompare(b.operatorPublicName);
                                    })
                                    .map((selOpNoc) => {
                                        return {
                                            cells: [
                                                props.operators.find((op) => op.nocCode === selOpNoc.operatorNoc)
                                                    ?.operatorPublicName,
                                                selOpNoc.operatorNoc,
                                                <button
                                                    key={selOpNoc.operatorNoc}
                                                    className="govuk-link"
                                                    onClick={() => {
                                                        const selectedOperatorsWithRemoved =
                                                            pageState.inputs.consequenceOperators?.filter(
                                                                (opNoc) => opNoc.operatorNoc !== selOpNoc.operatorNoc,
                                                            ) || [];
                                                        operatorStateUpdate(
                                                            selectedOperatorsWithRemoved,
                                                            "consequenceOperators",
                                                        );
                                                    }}
                                                >
                                                    Remove
                                                </button>,
                                            ],
                                        };
                                    })}
                            />
                        ) : null}
                        <input
                            type="hidden"
                            name="consequenceOperators"
                            value={JSON.stringify(pageState.inputs.consequenceOperators || [])}
                        />
                        <TextInput<OperatorConsequence>
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
                        <Radios<OperatorConsequence>
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
                        <TimeSelector<OperatorConsequence>
                            display="Delay (optional)"
                            hint="Enter time in minutes"
                            displaySize="l"
                            value={pageState.inputs.disruptionDelay}
                            inputName="disruptionDelay"
                            stateUpdater={stateUpdater}
                            initialErrors={pageState.errors}
                            placeholderValue=""
                        />
                        <Select<OperatorConsequence>
                            inputName="disruptionSeverity"
                            display="Disruption severity"
                            displaySize="l"
                            defaultDisplay="Select severity"
                            selectValues={DISRUPTION_SEVERITIES}
                            stateUpdater={stateUpdater}
                            value={pageState.inputs.disruptionSeverity}
                            initialErrors={pageState.errors}
                        />
                        <input type="hidden" name="consequenceType" value="operatorWide" />
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
                                formAction={`/api${CREATE_CONSEQUENCE_OPERATOR_PATH}?draft=true`}
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
                                formAction={`/api/create-consequence-operator${
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
): Promise<{ props: CreateConsequenceOperatorProps } | { redirect: Redirect } | undefined> => {
    const cookies = parseCookies(ctx);
    const errorCookie = cookies[COOKIES_CONSEQUENCE_OPERATOR_ERRORS];

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

    const pageState = getPageState<OperatorConsequence>(
        errorCookie,
        operatorConsequenceSchema,
        disruption.id,
        consequence && isOperatorConsequence(consequence) ? consequence : undefined,
    );

    if (ctx.res) destroyCookieOnResponseObject(COOKIES_CONSEQUENCE_OPERATOR_ERRORS, ctx.res);

    const operatorsData = await fetchOperators({ adminAreaCodes: session.adminAreaCodes ?? ["undefined"] });

    const operatorUserNocCodes =
        session.isOperatorUser && session.operatorOrgId
            ? await getNocCodesForOperatorOrg(session.orgId, session.operatorOrgId)
            : [];

    return {
        props: {
            ...pageState,
            consequenceIndex: index,
            consequenceCount: disruption.consequences?.length ?? 0,
            operators: session.isOperatorUser
                ? operatorsData.filter((operator) => {
                      return operatorUserNocCodes.includes(operator.nocCode);
                  })
                : operatorsData,
            disruptionDescription: disruption.description || "",
            sessionWithOrg: session,
            template: disruption.template?.toString() || "",
            isEdit: !!consequence,
            showUnderground: session.showUnderground,
            showCoach: ENABLE_COACH_MODE_FEATURE_FLAG && ALLOWED_COACH_CONSEQUENCES.includes("operatorWide"),
        },
    };
};

export default CreateConsequenceOperator;
