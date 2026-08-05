import type { Metadata } from "next";
import "./globals.css";

const appName =
  process.env.NEXT_PUBLIC_APP_NAME || "Contoso Council Digital Permit Platform";

export const metadata: Metadata = {
  title: appName,
  description:
    "Apply for and manage licences and permits from Contoso Council",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const showSampleBanner =
    process.env.NEXT_PUBLIC_SHOW_SAMPLE_BANNER !== "false";

  return (
    <html lang="en" className="govuk-template">
      <body className="min-h-screen flex flex-col">
        {showSampleBanner && (
          <div
            role="status"
            className="bg-[#f47738] text-govuk-black text-center text-xs font-bold py-1.5 px-4 print:hidden"
          >
            Sample application. Do not enter real personal, payment, or identity data.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
