import { AdminArea, fetchAdminAreas } from "@create-disruptions-data/shared-ts/utils/refDataApi";
import { NextPageContext } from "next";
import Link from "next/link";
import { parseCookies } from "nookies";
import { ReactElement, SyntheticEvent, useState } from "react";
import { SingleValue } from "react-select";
import CsrfForm from "../../components/form/CsrfForm";
import SearchSelect from "../../components/form/SearchSelect";
import TextInput from "../../components/form/TextInput";
import { TwoThirdsLayout } from "../../components/layout/Layout";
import { COOKIES_ADD_ORG_ERRORS, SYSADMIN_MANAGE_ORGANISATIONS_PAGE_PATH } from "../../constants";
import { getOrganisationInfoById } from "../../data/dynamo";
import { PageState } from "../../interfaces";
import { AreaCodeValuePair, Organisation, organisationSchema } from "../../schemas/organisation.schema";
import { notEmpty } from "../../utils";
import { destroyCookieOnResponseObject } from "../../utils/apiUtils";
import { getSessionWithOrgDetail } from "../../utils/apiUtils/auth";
import { getStateUpdater } from "../../utils/formUtils";

const title = "Manage organisations - Create Transport Disruptions Service";
const description = "Manage organisations page for the Create Transport Disruptions Service";

export interface ManageOrgProps extends Organisation {
    adminAreas: AdminArea[];
    orgAdminAreas: AdminArea[];
}

const ManageOrgs = (props: PageState<Partial<ManageOrgProps>>): ReactElement => {
    const [pageState, setPageState] = useState<PageState<Partial<ManageOrgProps>>>(props);
    const stateUpdater = getStateUpdater(setPageState, pageState);
    const [searchInput, setSearchInput] = useState("");
    const [selected, setSelected] = useState<SingleValue<AreaCodeValuePair>>(null);

    const handleChange = (adminArea: SingleValue<AreaCodeValuePair>) => {
        if (
            adminArea &&
            (!pageState.inputs.adminAreaCodes ||
                !pageState.inputs.adminAreaCodes.some((data) => data === adminArea.value))
        ) {
            const areaToAdd = props.inputs.adminAreas?.find((area) => area.administrativeAreaCode === adminArea.value);

            if (areaToAdd) {
                setPageState({
                    ...pageState,
                    inputs: {
                        ...pageState.inputs,
                        orgAdminAreas: [...(pageState.inputs.orgAdminAreas || []), areaToAdd],
                    },
                });
            }
        }
        setSelected(null);
    };

    const removeCode = (e: SyntheticEvent, index: number) => {
        e.preventDefault();
        if (pageState.inputs.orgAdminAreas) {
            const orgAdminAreas = pageState.inputs.orgAdminAreas;
            orgAdminAreas.splice(index, 1);

            setPageState({
                ...pageState,
                inputs: {
                    ...pageState.inputs,
                    orgAdminAreas: [...orgAdminAreas],
                },
            });
        }
    };

    const getRows = () => {
        if (pageState.inputs.orgAdminAreas) {
            return pageState.inputs.orgAdminAreas.map((area, i) => ({
                cells: [
                    `${area.administrativeAreaCode} - ${area.name}`,
                    <button
                        id={`remove-stop-${area.administrativeAreaCode}`}
                        key={`remove-stop-${area.administrativeAreaCode}`}
                        className="govuk-link"
                        onClick={(e) => removeCode(e, i)}
                    >
                        Remove
                    </button>,
                ],
            }));
        }
        return [];
    };

    return (
        <TwoThirdsLayout title={title} description={description} errors={pageState.errors}>
            <CsrfForm action="/api/sysadmin/org" method="post" csrfToken={props.csrfToken}>
                <h1 className="govuk-heading-xl">Add new organisation</h1>
                <TextInput<Organisation>
                    display="Organisation name"
                    inputName="name"
                    widthClass="w border-3"
                    value={pageState.inputs.name}
                    initialErrors={pageState.errors}
                    schema={organisationSchema.shape.name}
                    stateUpdater={stateUpdater}
                    maxLength={100}
                />
                <SearchSelect<AreaCodeValuePair>
                    selected={selected}
                    inputName="adminAreaCodes"
                    initialErrors={pageState.errors}
                    placeholder="Select code"
                    getOptionLabel={undefined}
                    handleChange={handleChange}
                    tableData={[]}
                    getRows={getRows}
                    getOptionValue={undefined}
                    display="NaPTAN AdminArea"
                    displaySize="s"
                    inputId="adminAreaCodes"
                    inputValue={searchInput}
                    setSearchInput={setSearchInput}
                    isClearable
                    options={pageState.inputs.adminAreas?.map((area) => ({
                        label: `${area.administrativeAreaCode} - ${area.name}`,
                        value: area.administrativeAreaCode,
                    }))}
                    width="100%"
                />

                <input type="hidden" name="PK" value={pageState.inputs.PK} />
                <input
                    type="hidden"
                    name="adminAreaCodes"
                    value={pageState.inputs.orgAdminAreas?.map((area) => area.administrativeAreaCode) ?? []}
                />
                <input type="hidden" name="mode" value={JSON.stringify(pageState.inputs.mode)} />
                <button className="govuk-button mt-2" data-module="govuk-button">
                    {pageState.inputs.PK ? "Update" : "Add"}
                </button>

                <Link
                    role="button"
                    href={SYSADMIN_MANAGE_ORGANISATIONS_PAGE_PATH}
                    className="govuk-button mt-2 ml-7 govuk-button--secondary"
                >
                    Cancel
                </Link>
            </CsrfForm>
        </TwoThirdsLayout>
    );
};

export const getServerSideProps = async (
    ctx: NextPageContext,
): Promise<{ props: PageState<Partial<ManageOrgProps>> }> => {
    const cookies = parseCookies(ctx);
    const errorCookie = cookies[COOKIES_ADD_ORG_ERRORS];

    if (!ctx.req) {
        throw new Error("No context request");
    }

    if (ctx.res) destroyCookieOnResponseObject(COOKIES_ADD_ORG_ERRORS, ctx.res);

    const session = await getSessionWithOrgDetail(ctx.req);

    if (!session) {
        throw new Error("No session found");
    }
    if (!session.isSystemAdmin) {
        throw new Error("Invalid user accessing the page");
    }

    const orgId = ctx.query.orgId?.toString();

    const [orgInfo, adminAreas] = await Promise.all([orgId ? getOrganisationInfoById(orgId) : null, fetchAdminAreas()]);
    const orgAdminAreas: AdminArea[] =
        orgInfo?.adminAreaCodes
            .map((code): AdminArea | null => {
                const adminArea = adminAreas.find((area) => area.administrativeAreaCode === code);

                if (!adminArea) {
                    return null;
                }

                return {
                    administrativeAreaCode: adminArea.administrativeAreaCode,
                    name: adminArea.name,
                    shortName: adminArea.shortName,
                };
            })
            .filter(notEmpty) ?? [];

    let pageState: PageState<Partial<Organisation>> = {
        errors: [],
        inputs: {},
    };

    if (errorCookie) {
        pageState = JSON.parse(errorCookie) as PageState<Partial<Organisation>>;
    } else if (orgInfo) {
        pageState.inputs = orgInfo;
    }

    return {
        props: {
            ...pageState,
            inputs: { ...pageState.inputs, adminAreas, orgAdminAreas },
        },
    };
};

export default ManageOrgs;
