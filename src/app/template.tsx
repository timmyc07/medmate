import PageTransition from "../components/PageTransition";

export default function Template({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <PageTransition>{children}</PageTransition>;
}
