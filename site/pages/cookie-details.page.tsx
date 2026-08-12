import Link from "next/link";
import { ReactElement } from "react";
import { TwoThirdsLayout } from "../components/layout/Layout";

const title = "Cookie details - Create Transport Disruption Data Service";
const description = "Cookie details page for the Create Transport Disruption Data Service";

const Contact = (): ReactElement => {
    return (
        <TwoThirdsLayout title={title} description={description}>
            <h1 className="govuk-heading-xl">Details about cookies on the Create Transport Disruption Data Service</h1>
            <p className="govuk-body">
                The Create Transport Disruption Data Service puts small files (known as ‘cookies’) onto your computer to
                collect information about how you browse the site. Find out more about the cookies we use, what they’re
                for and when they expire.
            </p>
            <h2 className="govuk-heading-m">Strictly necessary cookies</h2>
            <h3 className="govuk-heading-s">Progress through the tool</h3>
            <p className="govuk-body">
                When you use the Create Transport Disruption Data Service we will set the following cookies as you
                progress through the forms.
            </p>
            <table className="govuk-table cookie-detail-table">
                <thead className="govuk-table__head">
                    <tr className="govuk-table__row">
                        <th scope="col" className="govuk-table__header">
                            Name
                        </th>
                        <th scope="col" className="govuk-table__header">
                            Purpose
                        </th>
                        <th scope="col" className="govuk-table__header">
                            Expires
                        </th>
                    </tr>
                </thead>
                <tbody className="govuk-table__body">
                    <tr className="govuk-table__row">
                        <td className="govuk-table__cell">_csrf</td>
                        <td className="govuk-table__cell">Used to secure form submissions</td>
                        <td className="govuk-table__cell">When you close your browser</td>
                    </tr>
                </tbody>
            </table>
            <h3 className="govuk-heading-s">Cookies message</h3>
            <p className="govuk-body">
                You may see a banner when you visit GOV.UK inviting you to accept cookies or review your settings. We’ll
                set cookies so that your computer knows you’ve seen it and not to show it again, and also to store your
                settings.
            </p>
            <table className="govuk-table cookie-detail-table">
                <thead className="govuk-table__head">
                    <tr className="govuk-table__row">
                        <th scope="col" className="govuk-table__header">
                            Name
                        </th>
                        <th scope="col" className="govuk-table__header">
                            Purpose
                        </th>
                        <th scope="col" className="govuk-table__header">
                            Expires
                        </th>
                    </tr>
                </thead>
                <tbody className="govuk-table__body">
                    <tr className="govuk-table__row">
                        <td className="govuk-table__cell">cdd-cookies-policy</td>
                        <td className="govuk-table__cell">Saves your cookie consent settings</td>
                        <td className="govuk-table__cell">1 year</td>
                    </tr>
                    <tr className="govuk-table__row">
                        <td className="govuk-table__cell">cdd-cookie-preferences-set</td>
                        <td className="govuk-table__cell">
                            Lets us know that you’ve saved your cookie consent settings
                        </td>
                        <td className="govuk-table__cell">1 year</td>
                    </tr>
                </tbody>
            </table>
            <h2 className="govuk-heading-m">Change your settings</h2>
            <p className="govuk-body">
                You can{" "}
                <Link className="govuk-link" href="/cookies">
                    change which cookies you’re happy for us to use
                </Link>
                .
            </p>
        </TwoThirdsLayout>
    );
};

export const getServerSideProps = () => {
    return { props: {} };
};

export default Contact;
