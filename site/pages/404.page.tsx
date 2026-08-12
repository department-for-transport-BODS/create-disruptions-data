import Link from "next/link";
import { ReactElement } from "react";
import { TwoThirdsLayout } from "../components/layout/Layout";

const title = "Error - Create Transport Disruption Data Service";
const description = "404 page for the Create Transport Disruption Data Service";

const Error = (): ReactElement => (
    <TwoThirdsLayout title={title} description={description}>
        <div>
            <h1 className="govuk-heading-l">Page not found</h1>
            <p className="govuk-body">If you typed the web address, check it is correct.</p>
            <p className="govuk-body">If you pasted the web address, check you copied the entire address.</p>
            <p className="govuk-body">
                If the web address is correct or you selected a link or button,{" "}
                <Link className="govuk-link" id="contact-link" href="/contact">
                    contact
                </Link>{" "}
                us about your disruptions data.
            </p>
        </div>

        <br />
        <Link href="/" role="button" draggable="false" className="govuk-button" data-module="govuk-button">
            Start again
        </Link>
    </TwoThirdsLayout>
);

export default Error;
