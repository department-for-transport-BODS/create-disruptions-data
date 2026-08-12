import { randomUUID } from "crypto";
import { Progress } from "@create-disruptions-data/shared-ts/enums";
import { NextPageContext } from "next";
import { ReactElement } from "react";
import ViewAllContents, { ViewAllContentProps } from "../components/ViewAllContents";
import { BaseLayout } from "../components/layout/Layout";
import { ENABLE_COACH_MODE_FEATURE_FLAG } from "../constants";
import { getSessionWithOrgDetail } from "../utils/apiUtils/auth";

const title = "View All Disruptions";
const description = "View All Disruptions page for the Create Transport Disruptions Service";

const ViewAllDisruptions = ({
    newContentId,
    adminAreaCodes,
    filterStatus,
    enableLoadingSpinnerOnPageLoad = true,
    orgId,
    showUnderground = false,
    showCoach = false,
}: ViewAllContentProps): ReactElement => {
    return (
        <BaseLayout title={title} description={description}>
            <ViewAllContents
                newContentId={newContentId}
                adminAreaCodes={adminAreaCodes}
                filterStatus={filterStatus}
                enableLoadingSpinnerOnPageLoad={enableLoadingSpinnerOnPageLoad}
                orgId={orgId}
                showUnderground={showUnderground}
                showCoach={showCoach}
            />
        </BaseLayout>
    );
};

export const getServerSideProps = async (ctx: NextPageContext): Promise<{ props: ViewAllContentProps }> => {
    const newContentId = randomUUID();

    const baseProps = {
        props: {
            newContentId,
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

    const showPending = ctx.query.pending?.toString() === "true";
    const showDraft = ctx.query.draft?.toString() === "true";

    return {
        props: {
            adminAreaCodes: session.adminAreaCodes,
            orgId: session.orgId,
            newContentId,
            ...(showPending
                ? { filterStatus: Progress.pendingApproval }
                : showDraft
                  ? { filterStatus: Progress.draft }
                  : {}),
            showUnderground: session.showUnderground,
            showCoach: ENABLE_COACH_MODE_FEATURE_FLAG,
        },
    };
};

export default ViewAllDisruptions;
