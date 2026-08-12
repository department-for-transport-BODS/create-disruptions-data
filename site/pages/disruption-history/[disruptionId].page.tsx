import { History } from "@create-disruptions-data/shared-ts/disruptionTypes.zod";
import { PublishStatus } from "@create-disruptions-data/shared-ts/enums";
import { getDate } from "@create-disruptions-data/shared-ts/utils/dates";
import { NextPageContext } from "next";
import Link from "next/link";
import { Fragment, ReactElement } from "react";
import Table from "../../components/form/Table";
import { BaseLayout } from "../../components/layout/Layout";
import { DISRUPTION_DETAIL_PAGE_PATH } from "../../constants/index";
import { getDbDisruption } from "../../data/db";
import { DisplayValuePair } from "../../interfaces";
import { getDisplayByValue } from "../../utils";
import { getSession } from "../../utils/apiUtils/auth";
import { convertDateTimeToFormat, getDaysInPast } from "../../utils/dates";

const title = "Disruption history";
const description = "Disruption history page for the Create Transport Disruptions Service";

export interface DisruptionHistoryPageProps {
    history: History[];
    disruptionId: string;
}

const statusMap: DisplayValuePair[] = [
    {
        display: "Open",
        value: PublishStatus.published,
    },
    {
        display: "Draft pending approval",
        value: PublishStatus.pendingApproval,
    },
    {
        display: "Editing",
        value: PublishStatus.editing,
    },
    {
        display: "Rejected",
        value: PublishStatus.rejected,
    },
    {
        display: "Edit pending approval",
        value: PublishStatus.editPendingApproval,
    },
    {
        display: "Draft",
        value: PublishStatus.draft,
    },
    {
        display: "Pending and editing",
        value: PublishStatus.pendingAndEditing,
    },
];

const getStatusToDisplay = (status: PublishStatus, nextStatus: PublishStatus | null) => {
    if (!nextStatus) {
        return `Status: ${status === PublishStatus.published ? "Open" : getDisplayByValue(statusMap, status)}`;
    }

    const currentDisplayStatus = getDisplayByValue(statusMap, status);
    const previousDisplayStatus = getDisplayByValue(statusMap, nextStatus);

    if (status !== nextStatus && currentDisplayStatus && previousDisplayStatus) {
        return `Changed status: ${previousDisplayStatus} to ${currentDisplayStatus}`;
    }

    return null;
};

const DisruptionHistory = ({ history, disruptionId }: DisruptionHistoryPageProps): ReactElement => (
    <BaseLayout title={title} description={description}>
        <h1 className="govuk-heading-xl">{title}</h1>
        {history.length > 0 ? (
            <Table
                rows={history.map((item, historyIndex) => {
                    const daysInPast = getDaysInPast(item.datetime);
                    const status = getStatusToDisplay(
                        item.status,
                        historyIndex !== history.length - 1 ? history[historyIndex + 1].status : null,
                    );

                    return {
                        cells: [
                            <Fragment key={item.datetime}>
                                <h2 className="govuk-heading-s mb-3">
                                    {item.user}, {daysInPast} day{daysInPast === 1 ? "" : "s"} ago
                                </h2>
                                {item.historyItems.map((historyItem, index) => (
                                    <p className="govuk-body mb-0" key={`${historyItem}-${index}`}>
                                        {historyItem}
                                    </p>
                                ))}
                                {status && <p className="govuk-body mb-0">{status}</p>}
                            </Fragment>,
                            <p className="text-right" key={`${item.datetime}-1`}>
                                {convertDateTimeToFormat(item.datetime, "DD/MM/YYYY HH:mm")}
                            </p>,
                        ],
                    };
                })}
            />
        ) : (
            <p className="govuk-body pl-0.5">No disruption history</p>
        )}
        <Link
            role="button"
            href={`${DISRUPTION_DETAIL_PAGE_PATH}/${disruptionId}`}
            className="govuk-button mt-8 govuk-button govuk-button--secondary"
        >
            Back to details
        </Link>
    </BaseLayout>
);

export const getServerSideProps = async (
    ctx: NextPageContext,
): Promise<{ props: DisruptionHistoryPageProps } | undefined> => {
    if (!ctx.req) {
        throw new Error("No context request");
    }

    const session = getSession(ctx.req);

    if (!session) {
        throw new Error("No session found");
    }

    const disruption = await getDbDisruption(ctx.query.disruptionId?.toString() ?? "", session.orgId);

    if (!disruption) {
        throw new Error("Disruption not found for disruption history page");
    }

    const history = disruption.history ? disruption.history.sort((a, b) => -a.datetime.localeCompare(b.datetime)) : [];

    const finalEndDate = disruption.validityEndTimestamp ? getDate(disruption.validityEndTimestamp) : null;

    if (finalEndDate?.isBefore(getDate())) {
        history.unshift({
            datetime: finalEndDate.toISOString(),
            status: PublishStatus.published,
            user: "System",
            historyItems: ["Changed status: Open to closed"],
        });
    }
    return {
        props: {
            history,
            disruptionId: disruption.id,
        },
    };
};

export default DisruptionHistory;
