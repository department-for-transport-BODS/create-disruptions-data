import kebabCase from "lodash/kebabCase";
import { ReactElement } from "react";

interface TabsProps {
    tabs: Tab[];
    tabsTitle: string;
    activeTabHeader: "live" | "upcoming" | "recentlyClosed";
}

interface Tab {
    tabHeader: string;
    content: ReactElement;
    handleTabClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

const Tabs = ({ tabsTitle, tabs, activeTabHeader }: TabsProps): ReactElement => (
    <div className="govuk-tabs" data-module="govuk-tabs">
        <h2 className="govuk-tabs__title">{tabsTitle}</h2>
        <ul className="govuk-tabs__list">
            {tabs.map((tab, index) => (
                <li
                    key={`tab-${index + 1}`}
                    className={`govuk-tabs__list-item${kebabCase(tab.tabHeader) === kebabCase(activeTabHeader) ? " govuk-tabs__list-item--selected" : ""}`}
                >
                    <a className="govuk-tabs__tab" href={`#${kebabCase(tab.tabHeader)}`} onClick={tab.handleTabClick}>
                        {tab.tabHeader}
                    </a>
                </li>
            ))}
        </ul>
        {tabs.map((tab, index) => (
            <div
                key={`tab-panel-${index + 1}`}
                className={`govuk-tabs__panel${kebabCase(tab.tabHeader) !== kebabCase(activeTabHeader) ? " govuk-tabs__panel--hidden" : ""}`}
                id={kebabCase(tab.tabHeader)}
            >
                {tab.content}
            </div>
        ))}
    </div>
);

export default Tabs;
