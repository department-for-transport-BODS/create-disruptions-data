import { faAngleDown, faUser } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { ReactElement } from "react";
import useDropdownMenu from "react-accessible-dropdown-menu-hook";
import { LOGIN_PAGE_PATH, SOCIAL_MEDIA_ACCOUNTS_PAGE_PATH, USER_MANAGEMENT_PAGE_PATH } from "../../constants";
import { Session } from "../../schemas/session.schema";
import CsrfForm from "../form/CsrfForm";

interface HeaderProps {
    session: Session | null;
    csrfToken: string;
}

const Header = ({ session, csrfToken }: HeaderProps): ReactElement => {
    const { buttonProps, itemProps, isOpen, setIsOpen } = useDropdownMenu(session?.isOrgAdmin ? 4 : 2);

    return (
        <header className="govuk-header border-b-10 border-govBlue" data-module="govuk-header">
            <div className="govuk-header__container mb-0 border-b-0 govuk-width-container">
                <div className="govuk-header__logo">
                    <Link href="https://www.gov.uk/" className="govuk-header__link govuk-header__link--homepage">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            focusable="false"
                            role="img"
                            viewBox="0 0 324 60"
                            height="30"
                            width="162"
                            fill="currentcolor"
                            className="govuk-header__logotype"
                            aria-label="GOV.UK"
                        >
                            <title>GOV.UK</title>
                            <g>
                                <circle cx="20" cy="17.6" r="3.7" />
                                <circle cx="10.2" cy="23.5" r="3.7" />
                                <circle cx="3.7" cy="33.2" r="3.7" />
                                <circle cx="31.7" cy="30.6" r="3.7" />
                                <circle cx="43.3" cy="17.6" r="3.7" />
                                <circle cx="53.2" cy="23.5" r="3.7" />
                                <circle cx="59.7" cy="33.2" r="3.7" />
                                <circle cx="31.7" cy="30.6" r="3.7" />
                                <path d="M33.1,9.8c.2-.1.3-.3.5-.5l4.6,2.4v-6.8l-4.6,1.5c-.1-.2-.3-.3-.5-.5l1.9-5.9h-6.7l1.9,5.9c-.2.1-.3.3-.5.5l-4.6-1.5v6.8l4.6-2.4c.1.2.3.3.5.5l-2.6,8c-.9,2.8,1.2,5.7,4.1,5.7h0c3,0,5.1-2.9,4.1-5.7l-2.6-8ZM37,37.9s-3.4,3.8-4.1,6.1c2.2,0,4.2-.5,6.4-2.8l-.7,8.5c-2-2.8-4.4-4.1-5.7-3.8.1,3.1.5,6.7,5.8,7.2,3.7.3,6.7-1.5,7-3.8.4-2.6-2-4.3-3.7-1.6-1.4-4.5,2.4-6.1,4.9-3.2-1.9-4.5-1.8-7.7,2.4-10.9,3,4,2.6,7.3-1.2,11.1,2.4-1.3,6.2,0,4,4.6-1.2-2.8-3.7-2.2-4.2.2-.3,1.7.7,3.7,3,4.2,1.9.3,4.7-.9,7-5.9-1.3,0-2.4.7-3.9,1.7l2.4-8c.6,2.3,1.4,3.7,2.2,4.5.6-1.6.5-2.8,0-5.3l5,1.8c-2.6,3.6-5.2,8.7-7.3,17.5-7.4-1.1-15.7-1.7-24.5-1.7h0c-8.8,0-17.1.6-24.5,1.7-2.1-8.9-4.7-13.9-7.3-17.5l5-1.8c-.5,2.5-.6,3.7,0,5.3.8-.8,1.6-2.3,2.2-4.5l2.4,8c-1.5-1-2.6-1.7-3.9-1.7,2.3,5,5.2,6.2,7,5.9,2.3-.4,3.3-2.4,3-4.2-.5-2.4-3-3.1-4.2-.2-2.2-4.6,1.6-6,4-4.6-3.7-3.7-4.2-7.1-1.2-11.1,4.2,3.2,4.3,6.4,2.4,10.9,2.5-2.8,6.3-1.3,4.9,3.2-1.8-2.7-4.1-1-3.7,1.6.3,2.3,3.3,4.1,7,3.8,5.4-.5,5.7-4.2,5.8-7.2-1.3-.2-3.7,1-5.7,3.8l-.7-8.5c2.2,2.3,4.2,2.7,6.4,2.8-.7-2.3-4.1-6.1-4.1-6.1h10.6,0Z" />
                            </g>
                            <circle className="govuk-logo-dot" cx="227" cy="36" r="7.3" />
                            <path d="M94.7,36.1c0,1.9.2,3.6.7,5.4.5,1.7,1.2,3.2,2.1,4.5.9,1.3,2.2,2.4,3.6,3.2,1.5.8,3.2,1.2,5.3,1.2s3.6-.3,4.9-.9c1.3-.6,2.3-1.4,3.1-2.3.8-.9,1.3-2,1.6-3,.3-1.1.5-2.1.5-3v-.4h-11v-6.6h19.5v24h-7.7v-5.4c-.5.8-1.2,1.6-2,2.3-.8.7-1.7,1.3-2.7,1.8-1,.5-2.1.9-3.3,1.2-1.2.3-2.5.4-3.8.4-3.2,0-6-.6-8.4-1.7-2.5-1.1-4.5-2.7-6.2-4.7-1.7-2-3-4.4-3.8-7.1-.9-2.7-1.3-5.6-1.3-8.7s.5-6,1.5-8.7,2.4-5.1,4.2-7.1c1.8-2,4-3.6,6.5-4.7s5.4-1.7,8.6-1.7,4,.2,5.9.7c1.8.5,3.5,1.1,5.1,2,1.5.9,2.9,1.9,4,3.2,1.2,1.2,2.1,2.6,2.8,4.1l-7.7,4.3c-.5-.9-1-1.8-1.6-2.6-.6-.8-1.3-1.5-2.2-2.1-.8-.6-1.7-1-2.8-1.4-1-.3-2.2-.5-3.5-.5-2,0-3.8.4-5.3,1.2s-2.7,1.9-3.6,3.2c-.9,1.3-1.7,2.8-2.1,4.6s-.7,3.5-.7,5.3v.3h0ZM152.9,13.7c3.2,0,6.1.6,8.7,1.7,2.6,1.2,4.7,2.7,6.5,4.7,1.8,2,3.1,4.4,4.1,7.1s1.4,5.6,1.4,8.7-.5,6-1.4,8.7c-.9,2.7-2.3,5.1-4.1,7.1s-4,3.6-6.5,4.7c-2.6,1.1-5.5,1.7-8.7,1.7s-6.1-.6-8.7-1.7c-2.6-1.1-4.7-2.7-6.5-4.7-1.8-2-3.1-4.4-4.1-7.1-.9-2.7-1.4-5.6-1.4-8.7s.5-6,1.4-8.7,2.3-5.1,4.1-7.1c1.8-2,4-3.6,6.5-4.7s5.4-1.7,8.7-1.7h0ZM152.9,50.4c1.9,0,3.6-.4,5-1.1,1.4-.7,2.7-1.7,3.6-3,1-1.3,1.7-2.8,2.2-4.5.5-1.7.8-3.6.8-5.7v-.2c0-2-.3-3.9-.8-5.7-.5-1.7-1.3-3.3-2.2-4.5-1-1.3-2.2-2.3-3.6-3-1.4-.7-3.1-1.1-5-1.1s-3.6.4-5,1.1c-1.5.7-2.7,1.7-3.6,3s-1.7,2.8-2.2,4.5c-.5,1.7-.8,3.6-.8,5.7v.2c0,2.1.3,4,.8,5.7.5,1.7,1.2,3.2,2.2,4.5,1,1.3,2.2,2.3,3.6,3,1.5.7,3.1,1.1,5,1.1ZM189.1,58l-12.3-44h9.8l8.4,32.9h.3l8.2-32.9h9.7l-12.3,44M262.9,50.4c1.3,0,2.5-.2,3.6-.6,1.1-.4,2-.9,2.8-1.7.8-.8,1.4-1.7,1.9-2.9.5-1.2.7-2.5.7-4.1V14h8.6v28.5c0,2.4-.4,4.6-1.3,6.6-.9,2-2.1,3.6-3.7,5-1.6,1.4-3.4,2.4-5.6,3.2-2.2.7-4.5,1.1-7.1,1.1s-4.9-.4-7.1-1.1c-2.2-.7-4-1.8-5.6-3.2s-2.8-3-3.7-5c-.9-2-1.3-4.1-1.3-6.6V14h8.7v27.2c0,1.6.2,2.9.7,4.1.5,1.2,1.1,2.1,1.9,2.9.8.8,1.7,1.3,2.8,1.7s2.3.6,3.6.6h0ZM288.5,14h8.7v19.1l15.5-19.1h10.8l-15.1,17.6,16.1,26.4h-10.2l-11.5-19.7-5.6,6.3v13.5h-8.7" />
                        </svg>
                    </Link>
                </div>
                <div className="govuk-header__content">
                    <Link href="/" className="govuk-header__link govuk-header__service-name">
                        Create Transport Disruption Data
                    </Link>

                    <div className="govuk-header__account-link mt-2.5 mb-5 xs:m-0 xs:absolute xs:right-0 xs:top-1/2 xs:w-80 xs:text-right xs:-translate-y-1/2">
                        {session ? (
                            <>
                                <div className="group govuk-header__link mr-1.5 overflow-hidden float-right">
                                    <button
                                        className="text-white px-5 py-2 m-0 focus:outline-govYellow focus:bg-govYellow focus:text-focusText"
                                        {...buttonProps}
                                    >
                                        <FontAwesomeIcon className="mr-2" icon={faUser} />
                                        <strong>My Account</strong>
                                        <FontAwesomeIcon className="ml-2" icon={faAngleDown} />
                                    </button>
                                    <div
                                        className={`absolute bg-white min-w-max shadow-md z-10 px-0.5 group-hover:block group-focus:block ${
                                            isOpen ? "visible" : "invisible"
                                        }`}
                                        role="menu"
                                    >
                                        <Link
                                            className="float-none text-black text-left px-5 block hover:bg-slate-100 py-2 focus:text-focusText focus:bg-govYellow focus:outline-govYellow"
                                            href="/account-settings"
                                            onClick={() => setIsOpen(false)}
                                            {...itemProps[0]}
                                        >
                                            Account settings
                                        </Link>
                                        {session?.isOrgAdmin && (
                                            <Link
                                                className="float-none text-black text-left px-5 block hover:bg-slate-100 py-2 focus:text-focusText focus:bg-govYellow focus:outline-govYellow"
                                                href={USER_MANAGEMENT_PAGE_PATH}
                                                onClick={() => setIsOpen(false)}
                                                {...itemProps[1]}
                                            >
                                                User management
                                            </Link>
                                        )}
                                        {(session?.isOrgAdmin || session?.isOperatorUser) && (
                                            <Link
                                                className="float-none text-black text-left px-5 block hover:bg-slate-100 py-2 focus:text-focusText focus:bg-govYellow focus:outline-govYellow"
                                                href={SOCIAL_MEDIA_ACCOUNTS_PAGE_PATH}
                                                onClick={() => setIsOpen(false)}
                                                {...itemProps[2]}
                                            >
                                                Social media
                                            </Link>
                                        )}
                                        <CsrfForm action="/api/sign-out" method="post" csrfToken={csrfToken}>
                                            <button
                                                className="float-none text-black text-left px-5 w-full block hover:bg-slate-100 py-2 focus:text-focusText focus:bg-govYellow focus:outline-govYellow"
                                                onClick={() => setIsOpen(false)}
                                                {...(itemProps[itemProps.length - 1] as object)}
                                            >
                                                Sign out
                                            </button>
                                        </CsrfForm>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <Link href={LOGIN_PAGE_PATH} className="govuk-header__link">
                                <span> {"Sign in"} </span>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
