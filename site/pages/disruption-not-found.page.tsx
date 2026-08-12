import { NextPageContext } from "next";
import Link from "next/link";
import { ReactElement } from "react";
import { TwoThirdsLayout } from "../components/layout/Layout";
import { DASHBOARD_PAGE_PATH } from "../constants";
import { getSession } from "../utils/apiUtils/auth";

const title = "Disruption Not Found - Create Transport Disruption Data Service";
const description = "Disruption Not Found page for the Create Transport Disruption Data Service";

const DisruptionNotFound = ({ isTemplate }: { isTemplate: boolean }): ReactElement => (
    <TwoThirdsLayout title={title} description={description}>
        <div>
            <h1 className="govuk-heading-l">{`${isTemplate ? "Template" : "Disruption"} not found`}</h1>
            <p className="govuk-body">
                {" "}
                <Link className="govuk-link" id="contact-link" href={"/contact"}>
                    Contact
                </Link>{" "}
                us for assistance.
            </p>
        </div>

        <br />
        <Link
            href={DASHBOARD_PAGE_PATH}
            role="button"
            draggable="false"
            className="govuk-button"
            data-module="govuk-button"
        >
            Back to dashboard
        </Link>
    </TwoThirdsLayout>
);

export const getServerSideProps = (ctx: NextPageContext): { props: { isTemplate: boolean } } | undefined => {
    if (!ctx.req) {
        throw new Error("No context request");
    }

    const session = getSession(ctx.req);

    if (!session) {
        throw new Error("No session found");
    }

    return {
        props: {
            isTemplate: !!ctx.query?.template,
        },
    };
};

export default DisruptionNotFound;
