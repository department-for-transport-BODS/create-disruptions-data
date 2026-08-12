import Link from "next/link";
import { Dispatch, ReactElement, SetStateAction } from "react";

interface PageNumbersProps {
    currentPage: number;
    setCurrentPage: Dispatch<SetStateAction<number>>;
    numberOfPages: number;
}

const createPageNumbers = (
    numberOfPages: number,
    currentPage: number,
    setCurrentPage: Dispatch<SetStateAction<number>>,
) => {
    if (numberOfPages < 10) {
        const pageNumbers = [];

        for (let count = 0; count < numberOfPages; count++) {
            pageNumbers.push(
                <li
                    key={`page-${count + 1}`}
                    className={`govuk-pagination__item${
                        count + 1 === currentPage ? " govuk-pagination__item--current" : ""
                    }`}
                >
                    <Link
                        href="#"
                        role="button"
                        draggable="false"
                        className="govuk-link govuk-pagination__link"
                        data-module="govuk-button"
                        onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(count + 1);
                        }}
                        aria-label={`Page ${count + 1}`}
                    >
                        {count + 1}{" "}
                    </Link>
                </li>,
            );
        }

        return pageNumbers;
    }

    if (currentPage === 1) {
        return [
            <li className="govuk-pagination__item govuk-pagination__item--current" key="page-1">
                <Link
                    href="#"
                    role="button"
                    draggable="false"
                    className="govuk-link govuk-pagination__link"
                    data-module="govuk-button"
                    onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(1);
                    }}
                    aria-label="Page 1"
                >
                    1
                </Link>
            </li>,
            <li className="govuk-pagination__item" key="page-2">
                <Link
                    href="#"
                    role="button"
                    draggable="false"
                    className="govuk-link govuk-pagination__link"
                    data-module="govuk-button"
                    onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(2);
                    }}
                    aria-label="Page 2"
                >
                    2
                </Link>
            </li>,
            <li className="govuk-pagination__item govuk-pagination__item--ellipses" key="ellipses-1">
                ...
            </li>,
            <li className="govuk-pagination__item" key={`page-${numberOfPages}`}>
                <Link
                    href="#"
                    role="button"
                    draggable="false"
                    className="govuk-link govuk-pagination__link"
                    data-module="govuk-button"
                    onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(numberOfPages);
                    }}
                    aria-label={`Page ${numberOfPages}`}
                >
                    {numberOfPages}
                </Link>
            </li>,
        ];
    }

    if (currentPage === numberOfPages) {
        return [
            <li className="govuk-pagination__item" key="page-1">
                <Link
                    href="#"
                    role="button"
                    draggable="false"
                    className="govuk-link govuk-pagination__link"
                    data-module="govuk-button"
                    onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(1);
                    }}
                    aria-label="Page 1"
                >
                    1
                </Link>
            </li>,
            <li className="govuk-pagination__item govuk-pagination__item--ellipses" key="ellipses-1">
                ...
            </li>,
            <li className="govuk-pagination__item" key={`page-${numberOfPages - 1}`}>
                <Link
                    href="#"
                    role="button"
                    draggable="false"
                    className="govuk-link govuk-pagination__link"
                    data-module="govuk-button"
                    onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(numberOfPages - 1);
                    }}
                    aria-label={`Page ${numberOfPages - 1}`}
                >
                    {numberOfPages - 1}
                </Link>
            </li>,
            <li className="govuk-pagination__item govuk-pagination__item--current" key={`page-${numberOfPages}`}>
                <Link
                    href="#"
                    role="button"
                    draggable="false"
                    className="govuk-link govuk-pagination__link"
                    data-module="govuk-button"
                    onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(numberOfPages);
                    }}
                    aria-label={`Page ${numberOfPages}`}
                >
                    {numberOfPages}
                </Link>
            </li>,
        ];
    }

    const pageNumbers = [
        currentPage - 1 !== 1 ? (
            <li className="govuk-pagination__item" key="page-1">
                <Link
                    href="#"
                    role="button"
                    draggable="false"
                    className="govuk-link govuk-pagination__link"
                    data-module="govuk-button"
                    onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(1);
                    }}
                    aria-label="Page 1"
                >
                    1
                </Link>
            </li>
        ) : (
            []
        ),
        currentPage !== 2 ? (
            <li className="govuk-pagination__item govuk-pagination__item--ellipses" key="ellipses-1">
                ...
            </li>
        ) : (
            []
        ),
        <li className="govuk-pagination__item" key={`page-${currentPage - 1}`}>
            <Link
                href="#"
                role="button"
                draggable="false"
                className="govuk-link govuk-pagination__link"
                data-module="govuk-button"
                onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage(currentPage - 1);
                }}
                aria-label={`Page ${currentPage - 1}`}
            >
                {currentPage - 1}
            </Link>
        </li>,
        <li className="govuk-pagination__item govuk-pagination__item--current" key={`page-${currentPage}`}>
            <Link
                href="#"
                role="button"
                draggable="false"
                className="govuk-link govuk-pagination__link"
                data-module="govuk-button"
                onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage(currentPage);
                }}
                aria-label={`Page ${currentPage}`}
            >
                {currentPage}
            </Link>
        </li>,
        <li className="govuk-pagination__item" key={`page-${currentPage + 1}`}>
            <Link
                href="#"
                role="button"
                draggable="false"
                className="govuk-link govuk-pagination__link"
                data-module="govuk-button"
                onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage(currentPage + 1);
                }}
                aria-label={`Page ${currentPage + 1}`}
            >
                {currentPage + 1}
            </Link>
        </li>,
        currentPage !== numberOfPages - 1 ? (
            <li className="govuk-pagination__item govuk-pagination__item--ellipses" key="ellipses-2">
                ...
            </li>
        ) : (
            []
        ),
        currentPage + 1 !== numberOfPages ? (
            <li className="govuk-pagination__item" key={`page-${numberOfPages}`}>
                <Link
                    href="#"
                    role="button"
                    draggable="false"
                    className="govuk-link govuk-pagination__link"
                    data-module="govuk-button"
                    onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(numberOfPages);
                    }}
                    aria-label={`Page ${numberOfPages}`}
                >
                    {numberOfPages}
                </Link>
            </li>
        ) : (
            []
        ),
    ];

    return pageNumbers;
};

const PageNumbers = ({ currentPage, numberOfPages, setCurrentPage }: PageNumbersProps): ReactElement =>
    numberOfPages <= 1 ? (
        <></>
    ) : (
        <nav className="govuk-pagination justify-center">
            {currentPage !== 1 ? (
                <div className="govuk-pagination__prev">
                    <Link
                        href=""
                        role="button"
                        draggable="false"
                        className="govuk-link govuk-pagination__link"
                        data-module="govuk-button"
                        onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(currentPage - 1);
                        }}
                        aria-label={`Page ${numberOfPages}`}
                        rel="prev"
                    >
                        <svg
                            className="govuk-pagination__icon govuk-pagination__icon--prev"
                            xmlns="http://www.w3.org/2000/svg"
                            height="13"
                            width="15"
                            aria-hidden="true"
                            focusable="false"
                            viewBox="0 0 15 13"
                        >
                            <path d="m6.5938-0.0078125-6.7266 6.7266 6.7441 6.4062 1.377-1.449-4.1856-3.9768h12.896v-2h-12.984l4.2931-4.293-1.414-1.414z" />
                        </svg>
                        <span className="govuk-pagination__link-title">Previous</span>
                    </Link>
                </div>
            ) : null}

            <ul className="govuk-pagination__list"> {createPageNumbers(numberOfPages, currentPage, setCurrentPage)}</ul>
            {currentPage !== numberOfPages ? (
                <div className="govuk-pagination__next">
                    <Link
                        href=""
                        role="button"
                        draggable="false"
                        className="govuk-link govuk-pagination__link"
                        data-module="govuk-button"
                        onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(currentPage + 1);
                        }}
                        aria-label={`Page ${numberOfPages}`}
                        rel="next"
                    >
                        <span className="govuk-pagination__link-title">Next</span>{" "}
                        <svg
                            className="govuk-pagination__icon govuk-pagination__icon--next"
                            xmlns="http://www.w3.org/2000/svg"
                            height="13"
                            width="15"
                            aria-hidden="true"
                            focusable="false"
                            viewBox="0 0 15 13"
                        >
                            <path d="m8.107-0.0078125-1.4136 1.414 4.2926 4.293h-12.986v2h12.896l-4.1855 3.9766 1.377 1.4492 6.7441-6.4062-6.7246-6.7266z" />
                        </svg>
                    </Link>
                </div>
            ) : null}
        </nav>
    );
export default PageNumbers;
