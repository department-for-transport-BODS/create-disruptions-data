import { Organisation } from "@create-disruptions-data/shared-ts/organisationTypes";
import { getOrganisationsInfo } from "@create-disruptions-data/shared-ts/utils/dynamo";
import { NextPageContext } from "next";
import Link from "next/link";
import { ReactElement, ReactNode, useState } from "react";
import Table from "../../components/form/Table";
import { BaseLayout } from "../../components/layout/Layout";
import DeleteConfirmationPopup from "../../components/popup/DeleteConfirmationPopup";
import { getSessionWithOrgDetail } from "../../utils/apiUtils/auth";
import logger from "../../utils/logger";

export interface ManageOrganisationsProps {
    orgList: Organisation[];
    csrfToken?: string;
}

const title = "Manage organisations";
const description = "Manage organisations page for the Create Transport Disruptions Service";

const ManageOrganisations = ({ orgList, csrfToken }: ManageOrganisationsProps): ReactElement => {
    const [orgToDelete, setOrgToDelete] = useState<string>();

    const removeOrg = (orgId: string) => {
        setOrgToDelete(orgId);
    };
    const cancelActionHandler = () => {
        setOrgToDelete(undefined);
    };
    const getRows = () => {
        const rows: { header?: string | ReactNode; cells: string[] | ReactNode[] }[] = [];
        orgList.forEach((organisation, index) => {
            rows.push({
                cells: [organisation.name, organisation.adminAreaCodes.join(", "), createLink(index, organisation.id)],
            });
        });
        return rows;
    };

    const createLink = (index: number, orgId: string) => {
        return (
            <div className="flex">
                <Link
                    key={`org${index ? `-edit-${index}` : "-edit"}`}
                    className="govuk-link mr-5"
                    href={`/sysadmin/org?orgId=${orgId}`}
                >
                    Edit
                </Link>
                <Link
                    key={`org${index ? `-users-${index}` : "-users"}`}
                    className="govuk-link mr-5"
                    href={`/sysadmin/users?orgId=${orgId}`}
                >
                    Users
                </Link>
                <button
                    key={`org${index ? `-remove-${index}` : "-remove"}`}
                    className="govuk-link text-govBlue"
                    onClick={() => removeOrg(orgId)}
                >
                    Remove
                </button>
            </div>
        );
    };

    return (
        <BaseLayout title={title} description={description}>
            {orgToDelete ? (
                <DeleteConfirmationPopup
                    entityName="org"
                    deleteUrl="/api/sysadmin/delete-org"
                    cancelActionHandler={cancelActionHandler}
                    csrfToken={csrfToken || ""}
                    hiddenInputs={[
                        {
                            name: "org",
                            value: orgToDelete,
                        },
                    ]}
                    isOpen={!!orgToDelete}
                />
            ) : null}
            <h1 className="govuk-heading-l">Manage organisations</h1>
            <p className="govuk-body">
                Create, edit and remove organisations who can use the CTDD tool. Assign NaPTAN AdminAreas per
                organisations to ensure an organisation can create disruptions for their jurisdictions only, as well as
                being able to add and remove organisation admin users.
            </p>
            <Table columns={["Organisation", "NaPTAN AdminArea", "Action"]} rows={getRows()} />

            <Link
                href={"/sysadmin/org"}
                role="button"
                draggable="false"
                className="govuk-button"
                data-module="govuk-button"
                id="create-new-button"
            >
                Add new organisation
            </Link>
        </BaseLayout>
    );
};

export const getServerSideProps = async (ctx: NextPageContext): Promise<{ props: ManageOrganisationsProps }> => {
    if (!ctx.req) {
        throw new Error("No context request");
    }

    const sessionWithOrg = await getSessionWithOrgDetail(ctx.req);

    if (!sessionWithOrg) {
        throw new Error("No session found");
    }
    if (!sessionWithOrg.isSystemAdmin) {
        throw new Error("Access to system admins only");
    }

    const organisationsTableName = process.env.ORGANISATIONS_TABLE_NAME as string;

    const orgList: Organisation[] = (await getOrganisationsInfo(organisationsTableName, logger)) ?? [];

    return {
        props: {
            orgList: orgList.sort((a, b) => a.name.localeCompare(b.name)),
        },
    };
};

export default ManageOrganisations;
