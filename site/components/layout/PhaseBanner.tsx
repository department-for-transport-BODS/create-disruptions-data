import Link from "next/link";
import { ReactElement } from "react";

const PhaseBanner = (): ReactElement => (
    <div className="govuk-phase-banner max-w-[960px] w-[90%] border-0 mx-auto app-phase-banner app-width-container">
        <p className="govuk-phase-banner__content">
            <strong className="govuk-tag govuk-phase-banner__content__tag">Beta</strong>
            <span className="govuk-phase-banner__text">
                This is a new service. Help us improve it and{" "}
                <Link className="govuk-link" id="feedback-link" href="/feedback">
                    give your feedback (opens in new tab)
                </Link>
                .
            </span>
        </p>
    </div>
);

export default PhaseBanner;
