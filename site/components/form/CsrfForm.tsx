import { ReactElement, ReactNode } from "react";

interface CsrfFormProps {
    action: string;
    method: string;
    csrfToken?: string;
    children: ReactNode;
    [props: string]: unknown;
}

const CsrfForm = ({ action, method, csrfToken, children, ...props }: CsrfFormProps): ReactElement => (
    <form action={action} method={method} {...props}>
        <input type="hidden" name="csrf_token" value={csrfToken || ""} />
        {children}
    </form>
);

export default CsrfForm;
