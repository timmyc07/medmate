import { ViewTransition } from "react";

export default function PageTransition({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ViewTransition default="none" enter="page-enter" exit="page-exit">
      <div className="page-transition">{children}</div>
    </ViewTransition>
  );
}
