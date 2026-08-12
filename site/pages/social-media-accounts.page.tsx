import { NextPageContext } from "next";
import Link from "next/link";
import { parseCookies } from "nookies";
import { Fragment, ReactElement, useState } from "react";
import ErrorSummary from "../components/form/ErrorSummary";
import Table from "../components/form/Table";
import { BaseLayout } from "../components/layout/Layout";
import DeleteConfirmationPopup from "../components/popup/DeleteConfirmationPopup";
import { COOKIES_SOCIAL_MEDIA_ACCOUNT_ERRORS } from "../constants";
import { getHootsuiteAccountList, getHootsuiteAuthUrl } from "../data/hootsuite";
import { getNextdoorAccountList, getNextdoorAuthUrl } from "../data/nextdoor";
import { getTwitterAccountList, getTwitterAuthUrl } from "../data/twitter";
import { ErrorInfo } from "../interfaces";
import { SocialMediaAccount } from "../schemas/social-media-accounts.schema";
import { toLowerStartCase } from "../utils";
import { getSessionWithOrgDetail } from "../utils/apiUtils/auth";

const title = "Social Media Accounts - Create Transport Disruptions Service";
const description = "Social Media Accounts page for the Create Transport Disruptions Service";

export interface SocialMediaAccountsPageProps {
    socialMediaDetails: SocialMediaAccount[];
    hootsuiteAuthUrl: string;
    twitterAuthUrl: string;
    nextdoorAuthUrl: string;
    csrfToken?: string;
    errors: ErrorInfo[];
    isOperator: boolean;
}

const SocialMediaAccounts = ({
    socialMediaDetails,
    hootsuiteAuthUrl,
    twitterAuthUrl,
    nextdoorAuthUrl,
    csrfToken,
    errors,
    isOperator,
}: SocialMediaAccountsPageProps): ReactElement => {
    const [socialAccountToDelete, setSocialAccountToDelete] = useState<SocialMediaAccount>();
    const getLink = (type: string, id: string) => {
        switch (type.toLocaleUpperCase()) {
            case "TWITTER":
                return `https://twitter.com/intent/user?user_id=${id}/`;
            case "FACEBOOK":
                return `https://www.facebook.com/app_scoped_user_id/${id}/`;
            default:
                return "";
        }
    };

    const getRows = () => {
        const keys: (keyof SocialMediaAccount)[] = ["accountType", "display", "addedBy", "expiresIn"];

        return socialMediaDetails.length > 0
            ? socialMediaDetails.map((item) => ({
                  cells: [
                      ...keys.map((k) => <p key={k}>{item[k]?.toString()}</p>),
                      item.hootsuiteProfiles?.map((profile) => (
                          <Fragment key={profile.id}>
                              <li className="list-none">
                                  <Link
                                      className="govuk-link text-govBlue"
                                      key={`${toLowerStartCase(profile.type)}/${
                                          profile.socialNetworkUsername ?? profile.socialNetworkId
                                      }`}
                                      href={getLink(profile.type, profile.socialNetworkId)}
                                  >
                                      {`${toLowerStartCase(profile.type)}/${
                                          profile.socialNetworkUsername ?? profile.socialNetworkId
                                      }`}
                                  </Link>
                              </li>
                          </Fragment>
                      )) ?? "N/A",
                      <button
                          className="govuk-link text-govBlue"
                          key={`remove-${item.id}`}
                          onClick={() => {
                              setSocialAccountToDelete(item);
                          }}
                      >
                          Remove
                      </button>,
                  ],
              }))
            : [];
    };

    const cancelActionHandler = () => {
        setSocialAccountToDelete(undefined);
    };

    return (
        <BaseLayout title={title} description={description}>
            <>
                <h1 className="govuk-heading-xl">Social media accounts</h1>
                {errors && errors.length > 0 ? <ErrorSummary errors={errors} /> : null}
                {socialAccountToDelete ? (
                    <DeleteConfirmationPopup
                        entityName={`the ${socialAccountToDelete.accountType.toLowerCase()} connection`}
                        deleteUrl="/api/remove-social-connection"
                        cancelActionHandler={cancelActionHandler}
                        csrfToken={csrfToken || ""}
                        hiddenInputs={[
                            {
                                name: "profileId",
                                value: socialAccountToDelete.id,
                            },
                            {
                                name: "type",
                                value: socialAccountToDelete.accountType,
                            },
                        ]}
                        isOpen={!!socialAccountToDelete}
                    />
                ) : null}
                <Table
                    columns={[
                        "Account type",
                        "Username/page",
                        "Added by",
                        "Expires in",
                        "Hootsuite Profiles",
                        "Actions",
                    ]}
                    rows={getRows()}
                />

                <Link className="govuk-button mt-8 mr-4" data-module="govuk-button" href={hootsuiteAuthUrl}>
                    Connect Hootsuite
                </Link>
                <Link className="govuk-button mt-8 mr-4" data-module="govuk-button" href={twitterAuthUrl}>
                    Connect Twitter
                </Link>
                {!isOperator ? (
                    <Link className="govuk-button mt-8" data-module="govuk-button" href={nextdoorAuthUrl}>
                        Connect Nextdoor
                    </Link>
                ) : null}
            </>
        </BaseLayout>
    );
};

export const getServerSideProps = async (ctx: NextPageContext): Promise<{ props: SocialMediaAccountsPageProps }> => {
    const cookies = parseCookies(ctx);
    const errorCookie = cookies[COOKIES_SOCIAL_MEDIA_ACCOUNT_ERRORS];

    if (!ctx.req) {
        throw new Error("No context request");
    }

    let errors: ErrorInfo[] = [];
    if (errorCookie) {
        errors = (JSON.parse(errorCookie) as { errors: ErrorInfo[] }).errors;
    }

    const session = await getSessionWithOrgDetail(ctx.req);

    if (!session) {
        throw new Error("Session data not found");
    }

    const operatorOrgId = session.operatorOrgId || "";
    const [
        hootsuiteAccountList,
        twitterAccountList,
        nextdoorAccountList,
        hootsuiteAuthUrl,
        twitterAuthUrl,
        nextdoorAuthUrl,
    ] = await Promise.all([
        getHootsuiteAccountList(session.orgId, operatorOrgId),
        getTwitterAccountList(session.orgId, operatorOrgId),
        getNextdoorAccountList(session.orgId, operatorOrgId),
        getHootsuiteAuthUrl(ctx),
        getTwitterAuthUrl(ctx),
        getNextdoorAuthUrl(),
    ]);

    return {
        props: {
            socialMediaDetails: [...hootsuiteAccountList, ...twitterAccountList, ...nextdoorAccountList],
            hootsuiteAuthUrl,
            twitterAuthUrl,
            nextdoorAuthUrl,
            errors,
            isOperator: !!operatorOrgId,
        },
    };
};

export default SocialMediaAccounts;
