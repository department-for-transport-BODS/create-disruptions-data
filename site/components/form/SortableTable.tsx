import { SortOrder } from "@create-disruptions-data/shared-ts/enums";
import { Dispatch, ReactElement, ReactNode, SetStateAction, useEffect, useState } from "react";
import PageNumbers from "../layout/PageNumbers";

export interface TableColumn<T> {
    displayName: string;
    key: keyof T;
    sortable?: boolean;
    widthClass?: string;
}

interface SortableTableProps<T> {
    columns: TableColumn<T>[];
    rows: T[];
    pageCount: number;
    setCurrentPage: Dispatch<SetStateAction<number>>;
    currentPage: number;
    caption?: { text: string; size: "s" | "m" | "l" };
    sortOrder: SortOrder;
    setSortOrder: Dispatch<SetStateAction<SortOrder>>;
    sortedField: keyof T | null;
    setSortedField: Dispatch<SetStateAction<keyof T | null>>;
}

const SortableTable = <T extends object>({
    columns,
    rows,
    caption,
    pageCount,
    setCurrentPage,
    currentPage,
    sortedField,
    setSortedField,
    sortOrder,
    setSortOrder,
}: SortableTableProps<T>): ReactElement => {
    const [displayRows, setDisplayRows] = useState<T[]>(rows);

    const sortData = (field: keyof T) => {
        if (sortedField === field) {
            setSortOrder(sortOrder === SortOrder.asc ? SortOrder.desc : SortOrder.asc);
        } else {
            setSortedField(field);
            setSortOrder(SortOrder.asc);
        }
    };

    useEffect(() => {
        setDisplayRows(rows);
    }, [rows]);

    const getArrowHeads = (field: keyof T) => {
        if (!sortedField || sortedField !== field) {
            return (
                <div className="flex flex-col pl-1 text-arrow">
                    <span className="-mb-1">&#x25B2;</span>
                    <span>&#x25BC;</span>
                </div>
            );
        }
        return sortOrder === SortOrder.asc ? (
            <span className="pl-1 govuk-!-font-size-14">&#x25B2;</span>
        ) : (
            <span className="pl-1 govuk-!-font-size-14">&#x25BC;</span>
        );
    };

    return (
        <>
            <table className="govuk-table">
                {caption ? (
                    <caption className={`govuk-table__caption govuk-table__caption--${caption.size}`}>
                        {caption.text}
                    </caption>
                ) : (
                    ""
                )}
                <thead className="govuk-table__head">
                    <tr className="govuk-table__row">
                        {columns.map((column) => {
                            return column.sortable ? (
                                <th
                                    scope="col"
                                    className={`govuk-table__header align-middle px-2 ${
                                        column.widthClass ? column.widthClass : ""
                                    }`}
                                    key={`header-${column.displayName}`}
                                    onClick={() => sortData(column.key)}
                                >
                                    <div className="flex flex-row items-center">
                                        {column.displayName}
                                        {getArrowHeads(column.key)}
                                    </div>
                                </th>
                            ) : (
                                <th
                                    scope="col"
                                    className={`govuk-table__header align-middle px-2 ${
                                        column.widthClass ? column.widthClass : ""
                                    }`}
                                    key={`header-${column.displayName}`}
                                >
                                    {column.displayName}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="govuk-table__body">
                    {displayRows.map((row, index) => (
                        <tr className="govuk-table__row" key={`row-${index}`}>
                            {columns.map((column, i) => (
                                <td className={"govuk-table__cell align-middle px-2"} key={`row-${index}${i}`}>
                                    {row[column.key] as ReactNode}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            <PageNumbers numberOfPages={pageCount} currentPage={currentPage} setCurrentPage={setCurrentPage} />
        </>
    );
};

export default SortableTable;
