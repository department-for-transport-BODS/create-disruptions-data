import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { PropsWithChildren, ReactElement, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ErrorInfo } from "../../interfaces";
import { buildTitle } from "../../utils";
import CookieBanner from "./CookieBanner";
import Footer from "./Footer";
import PhaseBanner from "./PhaseBanner";

interface LayoutProps {
    title: string;
    description: string;
    errors?: ErrorInfo[];
    hideCookieBanner?: boolean;
    hideHelp?: boolean;
    disableBackButton?: boolean;
}

const Help = (): ReactElement => (
    <div>
        <h2 className="govuk-heading-s">Help and Support</h2>
        <p className="govuk-body">
            If you are having problems, please contact the Create Disruption Service via this link:{" "}
            <Link href="/contact" className="govuk-link govuk-!-font-size-19">
                Contact us
            </Link>
        </p>
    </div>
);

export const BaseLayout = ({
    title,
    description,
    errors = [],
    hideCookieBanner,
    children,
    hideHelp,
    disableBackButton = false,
}: PropsWithChildren<LayoutProps>): ReactElement => {
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        setShowBanner(true);
    }, [setShowBanner]);

    let element = null;
    if (typeof document !== "undefined") {
        element = document.getElementById("js-cookie-banner");
    }

    const router = useRouter();
    return (
        <>
            <Head>
                <link rel="icon" href="/assets/rebrand/images/favicon.ico" />
                <title>{buildTitle(errors, title || "Create Disruptions")}</title>
                <meta name="description" content={description || "Create Disruptions"} />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta charSet="utf-8" />
            </Head>

            {!hideCookieBanner && showBanner && element && <div>{createPortal(<CookieBanner />, element)}</div>}
            <PhaseBanner />

            <div className="govuk-width-container">
                {!disableBackButton && (
                    <button type="button" onClick={() => router.back()} className="govuk-back-link mb-7">
                        Back
                    </button>
                )}
                <main className="govuk-main-wrapper" id="main-content">
                    {children}
                </main>
                {!hideHelp && <Help />}
            </div>
            <Footer />
        </>
    );
};

export const FullColumnLayout = ({
    title,
    description,
    errors = [],
    children,
    hideCookieBanner = false,
    hideHelp = false,
    disableBackButton = false,
}: PropsWithChildren<LayoutProps>): ReactElement => (
    <BaseLayout
        title={title}
        description={description}
        errors={errors}
        hideCookieBanner={hideCookieBanner}
        hideHelp={hideHelp}
        disableBackButton={disableBackButton}
    >
        <div className="govuk-grid-row">
            <div className="govuk-grid-column-full">{children}</div>
        </div>
    </BaseLayout>
);

export const TwoThirdsLayout = ({
    title,
    description,
    errors = [],
    children,
    hideCookieBanner = false,
    hideHelp = false,
    disableBackButton = false,
}: PropsWithChildren<LayoutProps>): ReactElement => (
    <BaseLayout
        title={title}
        description={description}
        errors={errors}
        hideCookieBanner={hideCookieBanner}
        hideHelp={hideHelp}
        disableBackButton={disableBackButton}
    >
        <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">{children}</div>
        </div>
    </BaseLayout>
);

export default TwoThirdsLayout;
