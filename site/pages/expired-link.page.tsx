import { ReactElement } from "react";
import { TwoThirdsLayout } from "../components/layout/Layout";
import { SUPPORT_EMAIL_ADDRESS } from "../constants";

const title = "Register link timeout - Create Transport Disruption Data Service";
const description = "Register link timeout page for the Create Transport Disruption Data Service";

const ExpiredLink = (): ReactElement => (
    <TwoThirdsLayout title={title} description={description}>
        <div
            className="govuk-notification-banner"
            role="region"
            aria-labelledby="govuk-notification-banner-title"
            data-module="govuk-notification-banner"
        >
            <div className="govuk-notification-banner__header">
                <h2 className="govuk-notification-banner__title" id="govuk-notification-banner-title">
                    Important
                </h2>
            </div>
            <div className="govuk-notification-banner__content">
                <p className="govuk-notification-banner__heading">
                    The link to create your password has expired <br />
                    <br />
                    <a className="govuk-notification-banner__link" href={`mailto:${SUPPORT_EMAIL_ADDRESS}`}>
                        Contact
                    </a>{" "}
                    the support desk to be issued a new link
                </p>
            </div>
        </div>
    </TwoThirdsLayout>
);

export default ExpiredLink;
