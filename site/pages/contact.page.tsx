import Link from "next/link";
import { ReactElement } from "react";
import { Config } from "sst/node/config";
import { BaseLayout } from "../components/layout/Layout";

const title = "Contact - Create Transport Disruption Data Service";
const description = "Contact page for the Create Transport Disruption Data Service";

interface ContactProps {
    supportEmail: string;
    supportPhone: string;
}

const Contact = ({ supportEmail, supportPhone }: ContactProps): ReactElement => {
    return (
        <BaseLayout title={title} description={description} hideHelp>
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    <h1 className="govuk-heading-l">Contact the Create Transport Disruption Data Service team</h1>
                    <h2 className="govuk-heading-m">Feedback and support</h2>
                    <p className="govuk-body">
                        If you are experiencing technical issues, or if you have any suggestions, comments or
                        criticisms, please contact the Create Transport Disruption Data team through one of the channels
                        below.
                    </p>
                    <p className="govuk-body">
                        The Help Desk is available Monday to Friday, 9am to 5pm (excluding Bank Holidays in England and
                        Wales, and the 24th of December).
                    </p>
                    <p className="govuk-body">The Help Desk can be contacted by telephone or email as follows.</p>
                    <p className="govuk-body">
                        Telephone: {supportPhone}
                        <br />
                        Email:{" "}
                        <Link className="govuk-link" href={`mailto:${supportEmail}`}>
                            {supportEmail}
                        </Link>
                    </p>
                    <h3 className="govuk-heading-s">Related services</h3>
                    <p className="govuk-body">
                        <Link
                            href="https://www.bus-data.dft.gov.uk/contact/"
                            aria-label="go to the bus open data service"
                            className="underline govuk-link"
                        >
                            https://www.bus-data.dft.gov.uk/contact/
                        </Link>
                        <br />
                        <br />
                        The Bus Open Data Service deals with queries relating to the use of Bus Open Data.
                    </p>
                </div>
                <div className="govuk-grid-column-one-third">
                    <h2 className="govuk-heading-s">Create Transport Disruption Data Service</h2>
                    <p className="govuk-body">
                        The Create Transport Disruption Data Service gives local transport authorities and operators
                        within England the ability to create disruptions for bus, light rail, ferry and tram services
                        Help documents
                    </p>
                </div>
            </div>
        </BaseLayout>
    );
};

export const getServerSideProps = () => {
    const supportEmail = Config.SUPPORT_EMAIL || "";
    const supportPhone = Config.SUPPORT_PHONE || "";
    return { props: { supportEmail, supportPhone } };
};

export default Contact;
