type IconName =
  | "calendar"
  | "calculator"
  | "chevronDown"
  | "chevronUp"
  | "chevronLeft"
  | "chevronRight"
  | "dashboard"
  | "edit"
  | "expense"
  | "income"
  | "logout"
  | "plus"
  | "trash"
  | "wallet"
  | "close"
  | "category"
  | "more"
  | "pause"
  | "receipt"
  | "search"
  | "settings";

type IconProps = {
  name: IconName;
  className?: string;
};

export function Icon({ name, className = "size-5" }: IconProps) {
  const paths: Record<IconName, React.ReactNode> = {
    calendar: <rect height="14" rx="2" width="16" x="4" y="5" />,
    calculator: (
      <>
        <rect height="18" rx="2" width="14" x="5" y="3" />
        <path
          d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"
          strokeWidth="2.4"
        />
      </>
    ),
    chevronDown: <path d="m6 9 6 6 6-6" />,
    chevronUp: <path d="m18 15-6-6-6 6" />,
    chevronLeft: <path d="m14 18-6-6 6-6" />,
    chevronRight: <path d="m10 6 6 6-6 6" />,
    dashboard: (
      <>
        <rect height="6" rx="1" width="6" x="3" y="3" />
        <rect height="6" rx="1" width="6" x="15" y="3" />
        <rect height="6" rx="1" width="6" x="3" y="15" />
        <rect height="6" rx="1" width="6" x="15" y="15" />
      </>
    ),
    edit: (
      <path d="m4 20 4.3-1 10.5-10.5a2.1 2.1 0 0 0-3-3L5.3 16 4 20Z M13.5 7.7l3 3" />
    ),
    expense: <path d="M4 7h16M4 12h12M4 17h8" />,
    income: <path d="m5 15 5-5 3 3 6-7M15 6h4v4" />,
    plus: <path d="M12 5v14M5 12h14" />,
    trash: <path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 13h10l1-13" />,
    wallet: (
      <>
        <path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
        <path d="M4 8h16M15 14h2" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    category: (
      <>
        <circle cx="7" cy="7" r="2" />
        <circle cx="17" cy="7" r="2" />
        <circle cx="7" cy="17" r="2" />
        <path d="M15 15h4v4h-4z" />
      </>
    ),
    more: <path d="M12 5h.01M12 12h.01M12 19h.01" strokeWidth="3" />,
    pause: <path d="M8 5v14M16 5v14" strokeWidth="2.4" />,
    receipt: (
      <>
        <path d="M6 3h12v18l-2.5-1.5L12 21l-3.5-1.5L6 21V3Z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="m16 16 4 4" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.3 2.3-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.3-2.3.1-.1A1.7 1.7 0 0 0 6.6 15a1.7 1.7 0 0 0-1.5-1H5v-3h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.3-2.3.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h3v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v3h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </>
    ),
    logout: (
      <>
        <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
        <path d="m14 16 4-4-4-4M18 12H9" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  );
}
