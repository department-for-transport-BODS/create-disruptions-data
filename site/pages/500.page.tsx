import Link from "next/link";
import { ReactElement } from "react";
import { TwoThirdsLayout } from "../components/layout/Layout";

const title = "Error - Create Transport Disruption Data Service";
const description = "500 page for the Create Transport Disruption Data Service";

const Error = (): ReactElement => (
    <TwoThirdsLayout title={title} description={description}>
        <div>
            <h1 className="govuk-heading-l">Sorry, there is a problem with the service.</h1>
            <p className="govuk-body">Try again later.</p>
            <p className="govuk-body">Your answers have not been saved, use the button below to start again.</p>
            <p className="govuk-body">
                {" "}
                <Link className="govuk-link" id="contact-link" href={"/contact"}>
                    Contact
                </Link>{" "}
                us for assistance.
            </p>
        </div>

        <br />
        <Link href="/" role="button" draggable="false" className="govuk-button" data-module="govuk-button">
            Start again
        </Link>
    </TwoThirdsLayout>
);

export default Error;
