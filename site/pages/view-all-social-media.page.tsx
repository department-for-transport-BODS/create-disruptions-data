import { NextPageContext } from "next";
import Link from "next/link";
import { ReactElement, ReactNode, useEffect, useRef } from "react";
import Table from "../components/form/Table";
import { BaseLayout } from "../components/layout/Layout";
import NotificationBanner from "../components/layout/NotificationBanner";
import { getPublishedSocialMediaPosts } from "../data/db";
import { getItem } from "../data/s3";
import { SocialMediaPost, SocialMediaPostTransformed } from "../schemas/social-media.schema";
import { getSession } from "../utils/apiUtils/auth";

const title = "View All Social Media";
const description = "View All Social Media page for the Create Transport Disruptions Service";

interface ViewAllSocialMediaProps {
    socialMediaPosts: SocialMediaPost[];
}

const ViewAllSocialMedia = ({ socialMediaPosts }: ViewAllSocialMediaProps): ReactElement => {
    const hasInitialised = useRef(false);
    useEffect(() => {
        if (window.GOVUKFrontend && !hasInitialised.current) {
            window.GOVUKFrontend.initAll();
        }

        hasInitialised.current = true;
    });
    const getSocialMediaRows = (post: SocialMediaPostTransformed) => {
        const socialMediaTableRows: { header?: string | ReactNode; cells: string[] | ReactNode[] }[] = [
            {
                header: "Message to appear",
                cells: [post.messageContent],
            },
            {
                header: "Image",
                cells: [
                    post.image ? (
                        <Link className="govuk-link text-govBlue" key={post.image.key} href={post.image?.url ?? ""}>
                            {post.image.originalFilename}
                        </Link>
                    ) : (
                        "No image uploaded"
                    ),
                ],
            },
            {
                header: "Publish date",
                cells: [post.accountType === "Hootsuite" ? post.publishDate : "N/A"],
            },
            {
                header: "Publish time",
                cells: [post.accountType === "Hootsuite" ? post.publishTime : "N/A"],
            },
            {
                header: "Account name",
                cells: [
                    post.display && post.accountType ? `${post.display} (${post.accountType})` : post.socialAccount,
                ],
            },
            {
                header: "HootSuite profile",
                cells: [post.accountType === "Hootsuite" ? post.hootsuiteProfile : "N/A"],
            },
            {
                header: "Nextdoor area boundaries",
                cells: [
                    post.accountType === "Nextdoor"
                        ? post.nextdoorAgencyBoundaries?.map((boundary) => boundary.name).join(", ") || "N/A"
                        : "N/A",
                ],
            },
            {
                header: "Status",
                cells: [post.status, ""],
            },
        ];

        return socialMediaTableRows;
    };

    return (
        <BaseLayout title={title} description={description}>
            <>
                <h1 className="govuk-heading-xl">Social media posts</h1>
                {socialMediaPosts.length > 0 ? (
                    <div className="govuk-accordion" data-module="govuk-accordion" id="accordion-default">
                        {socialMediaPosts?.map((post, i) => (
                            <div key={`social-media-post-${i + 1}`} className="govuk-accordion__section">
                                <div className="govuk-accordion__section-header">
                                    <h2 className="govuk-accordion__section-heading">
                                        <span
                                            className="govuk-accordion__section-button"
                                            id={`accordion-default-heading-${i + 1}`}
                                        >
                                            {`Social media post ${i + 1}`}
                                        </span>
                                    </h2>
                                </div>
                                <div
                                    id={`accordion-default-content-${i + 1}`}
                                    className="govuk-accordion__section-content"
                                    aria-labelledby={`accordion-default-heading-${i + 1}`}
                                >
                                    <Table rows={getSocialMediaRows(post)} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <NotificationBanner
                        content={"No live or upcoming disruptions currently have an associated social media message"}
                    />
                )}
                <Link className="govuk-button" href="/dashboard">
                    Return to dashboard
                </Link>
            </>
        </BaseLayout>
    );
};

export const getServerSideProps = async (
    ctx: NextPageContext,
): Promise<{ props: ViewAllSocialMediaProps } | undefined> => {
    if (!ctx.req) {
        throw new Error("No context request");
    }

    const session = getSession(ctx.req);

    if (!session) {
        throw new Error("No session found");
    }

    let socialMediaPosts = await getPublishedSocialMediaPosts(session.orgId);

    socialMediaPosts = session.isOperatorUser
        ? socialMediaPosts.filter(
              (post) => post.createdByOperatorOrgId && post.createdByOperatorOrgId === session.operatorOrgId,
          )
        : socialMediaPosts.filter((post) => !post.createdByOperatorOrgId);

    let socialMediaWithImageLinks: SocialMediaPost[] = [];
    if (socialMediaPosts && process.env.IMAGE_BUCKET_NAME) {
        socialMediaWithImageLinks = await Promise.all(
            socialMediaPosts.map(async (s) => {
                if (s.image) {
                    const url =
                        (await getItem(process.env.IMAGE_BUCKET_NAME || "", s.image?.key, s.image?.originalFilename)) ||
                        "";
                    return {
                        ...s,
                        image: {
                            ...s.image,
                            url,
                        },
                    };
                }
                return s;
            }),
        );
    }

    return {
        props: {
            socialMediaPosts: socialMediaWithImageLinks.length > 0 ? socialMediaWithImageLinks : [],
        },
    };
};

export default ViewAllSocialMedia;
