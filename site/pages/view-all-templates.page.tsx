import { randomUUID } from "crypto";
import { Progress } from "@create-disruptions-data/shared-ts/enums";
import { NextPageContext, Redirect } from "next";
import { ReactElement } from "react";
import ViewAllContents, { ViewAllContentProps } from "../components/ViewAllContents";
import { BaseLayout } from "../components/layout/Layout";
import { getSessionWithOrgDetail } from "../utils/apiUtils/auth";

const title = "Templates";
const description = "Templates page for the Create Transport Disruptions Service";

const ViewAllTemplates = ({
    newContentId,
    adminAreaCodes,
    filterStatus,
    enableLoadingSpinnerOnPageLoad = true,
    orgId,
}: ViewAllContentProps): ReactElement => {
    return (
        <BaseLayout title={title} description={description}>
            <ViewAllContents
                newContentId={newContentId}
                adminAreaCodes={adminAreaCodes}
                filterStatus={filterStatus}
                enableLoadingSpinnerOnPageLoad={enableLoadingSpinnerOnPageLoad}
                isTemplate={true}
                orgId={orgId}
            />
        </BaseLayout>
    );
};

export const getServerSideProps = async (
    ctx: NextPageContext,
): Promise<{ props: ViewAllContentProps } | { redirect: Redirect }> => {
    const baseProps = {
        props: {
            newContentId: randomUUID(),
            adminAreaCodes: [],
            orgId: "",
        },
    };

    if (!ctx.req) {
        return baseProps;
    }

    const session = await getSessionWithOrgDetail(ctx.req);

    if (!session) {
        return baseProps;
    }

    if (session.isOperatorUser) {
        return {
            redirect: {
                destination: "/404",
                statusCode: 302,
            },
        };
    }

    const showPending = ctx.query.pending?.toString() === "true";
    const showDraft = ctx.query.draft?.toString() === "true";

    return {
        props: {
            adminAreaCodes: session.adminAreaCodes,
            orgId: session.orgId,
            newContentId: randomUUID(),
            ...(showPending
                ? { filterStatus: Progress.pendingApproval }
                : showDraft
                  ? { filterStatus: Progress.draft }
                  : {}),
        },
    };
};
export default ViewAllTemplates;
