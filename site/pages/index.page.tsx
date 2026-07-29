import Link from "next/link";
import { BaseLayout } from "../components/layout/Layout";

const title = "Create Transport Disruption Data";
const description =
    "Create Transport Disruption Data is a service that allows you to generate disruptions data in SIRI-SX format";

const Home = () => {
    return (
        <BaseLayout title={title} description={description} disableBackButton>
            <h1 className="govuk-heading-xl">Create transport disruption data</h1>
            <p className="govuk-body">
                This service is for creating disruption data for public transport services, excluding rail, in England.
            </p>

            <p className="govuk-body">The service can be used by:</p>
            <ul className="govuk-list govuk-list--bullet">
                <li>Local transport authorities that operate their own services</li>
                <li>Bus operators running commercial services in England</li>
                <li>Local transport authorities acting on behalf of bus operators</li>
            </ul>

            <p className="govuk-body">Use this service to:</p>
            <ul className="govuk-list govuk-list--bullet">
                <li>Generate disruption data output format for a new or existing public transport disruption</li>
                <li>Download your own transport disruptions data</li>
            </ul>

            <Link
                href="/dashboard"
                role="button"
                draggable="false"
                className="govuk-button govuk-button--start"
                data-module="govuk-button"
                id="start-now-button"
            >
                Start now
                <svg
                    className="govuk-button__start-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="17.5"
                    height="19"
                    viewBox="0 0 33 40"
                    role="presentation"
                    focusable="false"
                >
                    <path fill="currentColor" d="M0 0h13l20 20-20 20H0l20-20z" />
                </svg>
            </Link>
        </BaseLayout>
    );
};

export const getServerSideProps = () => {
    return { props: {} };
};

export default Home;
