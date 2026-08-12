import { NextPageContext } from "next";
import Link from "next/link";
import { parseCookies } from "nookies";
import { ReactElement, SyntheticEvent, useState } from "react";
import { SingleValue } from "react-select";
import CsrfForm from "../../components/form/CsrfForm";
import ErrorSummary from "../../components/form/ErrorSummary";
import SearchSelect from "../../components/form/SearchSelect";
import Table from "../../components/form/Table";
import TextInput from "../../components/form/TextInput";
import { TwoThirdsLayout } from "../../components/layout/Layout";
import { sortOperatorByName } from "../../components/search/OperatorSearch";
import { COOKIES_ADD_OPERATOR_ERRORS } from "../../constants";
import { fetchOperators } from "../../data/refDataApi";
import { PageState } from "../../interfaces";
import { AddOperatorSchema, addOperatorSchema } from "../../schemas/add-operator.schema";
import { Operator, operatorSchema } from "../../schemas/consequence.schema";
import { flattenZodErrors, removeDuplicates } from "../../utils";
import { destroyCookieOnResponseObject, getPageState } from "../../utils/apiUtils";
import { getSessionWithOrgDetail } from "../../utils/apiUtils/auth";
import { getStateUpdater } from "../../utils/formUtils";

const title = "Add Operator - Create Transport Disruptions Service";
const description = "Add Operator page for the Create Transport Disruptions Service";

export interface AddOperatorPageProps extends PageState<Partial<AddOperatorSchema>> {
    allOperatorsData?: Pick<Operator, "id" | "operatorPublicName" | "nocCode">[];
}

const AddOperator = (props: AddOperatorPageProps): ReactElement => {
    const [pageState, setPageState] = useState(props);
    const [selectedOperator, setSelectedOperator] = useState<SingleValue<Operator>>(null);
    const [operatorSearchInput, setOperatorsSearchInput] = useState<string>("");

    const allOperatorsData = pageState.allOperatorsData ?? [];

    const stateUpdater = getStateUpdater(setPageState, pageState);
    const handleOperatorChange = (value: SingleValue<Operator>) => {
        const parsed = operatorSchema.safeParse(value);

        if (!parsed.success) {
            setPageState({
                ...pageState,
                errors: [
                    ...pageState.errors.filter((err) => !Object.keys(addOperatorSchema.shape).includes(err.id)),
                    ...flattenZodErrors(parsed.error),
                ],
            });
        } else {
            setSelectedOperator(parsed.data);
            setPageState({
                ...pageState,
                inputs: {
                    ...pageState.inputs,
                    nocCodes: [...(pageState.inputs.nocCodes ?? []), parsed.data],
                },
                errors: [...pageState.errors.filter((err) => !Object.keys(addOperatorSchema.shape).includes(err.id))],
            });
        }
    };

    const removeOperator = (e: SyntheticEvent, removedNocCode: string) => {
        e.preventDefault();

        if (pageState?.inputs?.nocCodes) {
            const updatedNocCodesArray = [...pageState.inputs.nocCodes].filter(
                (operator) => operator.nocCode !== removedNocCode,
            );

            setPageState({
                ...pageState,
                inputs: {
                    ...pageState.inputs,
                    nocCodes: updatedNocCodesArray,
                },
                errors: pageState.errors,
            });
        }
        setSelectedOperator(null);
    };

    const getOperatorRows = () => {
        if (pageState.inputs.nocCodes) {
            return sortOperatorByName(pageState.inputs.nocCodes).map((operator) => ({
                cells: [
                    `${operator.nocCode} - ${operator.operatorPublicName}`,
                    <button
                        id={`remove-service-${operator.nocCode}`}
                        key={`remove-service-${operator.nocCode}`}
                        className="govuk-link"
                        onClick={(e) => removeOperator(e, operator.nocCode)}
                    >
                        Remove
                    </button>,
                ],
            }));
        }
        return [];
    };

    return (
        <>
            <TwoThirdsLayout title={title} description={description} errors={pageState.errors}>
                <CsrfForm action={"/api/admin/add-operator"} method="post" csrfToken={pageState.csrfToken}>
                    <>
                        <ErrorSummary errors={pageState.errors} />
                        <h1 className="govuk-heading-xl">{"Add new operator"}</h1>
                        <TextInput<AddOperatorSchema>
                            display="Operator name"
                            inputName="operatorName"
                            widthClass="w"
                            value={pageState.inputs.operatorName}
                            initialErrors={pageState.errors}
                            stateUpdater={stateUpdater}
                            maxLength={100}
                        />

                        <Table rows={[{ header: "Organisation", cells: [pageState.sessionWithOrg?.orgName, ""] }]} />

                        <h1 className="govuk-heading-l">What NOC codes do they require?</h1>

                        <SearchSelect<Operator>
                            selected={selectedOperator}
                            inputName="nocCodes"
                            initialErrors={pageState.errors}
                            placeholder="Select operator NOC codes"
                            getOptionLabel={(operator) => `${operator.nocCode} - ${operator.operatorPublicName}`}
                            options={sortOperatorByName(allOperatorsData).filter((operatorOption) =>
                                pageState.inputs.nocCodes
                                    ? !pageState.inputs.nocCodes.find(
                                          (selectedOperators) => selectedOperators.id === operatorOption.id,
                                      )
                                    : true,
                            )}
                            handleChange={handleOperatorChange}
                            tableData={pageState?.inputs?.nocCodes}
                            getRows={getOperatorRows}
                            getOptionValue={(operator: Operator) => operator.id.toString()}
                            display="NOC Code"
                            hint=""
                            displaySize="s"
                            inputId="nocCodes"
                            isClearable
                            inputValue={operatorSearchInput}
                            setSearchInput={setOperatorsSearchInput}
                        />

                        <button className="govuk-button mt-8 mr-5" data-module="govuk-button">
                            {"Add operator"}
                        </button>
                        <Link
                            role="button"
                            href="/admin/user-management"
                            className="govuk-button mt-8 govuk-button--secondary"
                        >
                            Cancel
                        </Link>
                    </>
                </CsrfForm>
            </TwoThirdsLayout>
        </>
    );
};

export const getServerSideProps = async (ctx: NextPageContext): Promise<{ props: AddOperatorPageProps }> => {
    const cookies = parseCookies(ctx);
    const errorCookie = cookies[COOKIES_ADD_OPERATOR_ERRORS];

    if (!ctx.req) {
        throw new Error("No context request");
    }

    if (ctx.res) destroyCookieOnResponseObject(COOKIES_ADD_OPERATOR_ERRORS, ctx.res);

    const session = await getSessionWithOrgDetail(ctx.req);

    if (!session) {
        throw new Error("No session found");
    }

    const allOperatorsData: Operator[] = await fetchOperators({
        adminAreaCodes: session.adminAreaCodes ?? ["undefined"],
    });

    const filteredOperatorsData = removeDuplicates(
        allOperatorsData.map((operator) => {
            return {
                id: operator.id,
                nocCode: operator.nocCode,
                operatorPublicName: operator.operatorPublicName,
            };
        }),
        "id",
    );

    return {
        props: {
            ...getPageState(errorCookie, addOperatorSchema),
            sessionWithOrg: session,
            allOperatorsData: filteredOperatorsData ?? [],
        },
    };
};

export default AddOperator;
